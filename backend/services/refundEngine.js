/**
 * refundEngine.js — single place that calls Razorpay's refund API and
 * records the outcome on the order.
 *
 * This exact logic previously only existed inline inside the
 * customer-initiated cancelOrder (orderController.js) — an admin
 * force-cancelling a PAID Razorpay order via updateOrderStatus never
 * triggered any refund at all, leaving payment.status:"PAID" with
 * refund.status:"NONE" forever. Both cancellation paths now share this.
 *
 * Non-throwing by design: always resolves. On Razorpay failure it records
 * refund.status:"REQUESTED" so the existing admin retryRefund flow can
 * pick it up later — never leaves the caller to guess what happened.
 */
import Razorpay from "razorpay";
import Order from "../models/Order.js";

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const refundOrderPayment = async (order, { reason = "Order cancelled", ip = "" } = {}) => {
    const eligible =
        order.payment?.method === "RAZORPAY" &&
        order.payment?.status === "PAID" &&
        order.refund?.status !== "PROCESSED" &&
        order.payment?.status !== "REFUNDED" &&
        order.payment?.razorpayPaymentId;

    if (!eligible) return { attempted: false };

    try {
        const refundResult = await razorpay.payments.refund(order.payment.razorpayPaymentId, {
            amount: Math.round(order.totalAmount * 100),
            notes: { orderId: order._id.toString(), reason },
        });
        await Order.findByIdAndUpdate(order._id, {
            $set: {
                "refund.status": "PROCESSED",
                "refund.processedAt": new Date(),
                "refund.razorpayRefundId": refundResult.id,
                "refund.requested": true,
                "refund.requestedAt": new Date(),
                "refund.reason": reason,
                "refund.amount": order.totalAmount,
                "payment.status": "REFUNDED",
            },
            $push: {
                paymentLogs: {
                    event: "REFUND_PROCESSED",
                    amount: order.totalAmount,
                    method: "RAZORPAY",
                    paymentId: refundResult.id,
                    ip,
                    at: new Date(),
                },
            },
        });
        return { attempted: true, success: true, refundId: refundResult.id };
    } catch (refundErr) {
        console.error("[refundOrderPayment] failed:", order._id, refundErr.message);
        await Order.findByIdAndUpdate(order._id, {
            $set: {
                "refund.status": "REQUESTED",
                "refund.requested": true,
                "refund.requestedAt": new Date(),
                "refund.reason": reason,
                "refund.amount": order.totalAmount,
            },
            $push: {
                paymentLogs: {
                    event: "REFUND_FAILED",
                    amount: order.totalAmount,
                    method: "RAZORPAY",
                    ip,
                    meta: { error: refundErr.message },
                    at: new Date(),
                },
            },
        });
        return { attempted: true, success: false, error: refundErr.message };
    }
};
