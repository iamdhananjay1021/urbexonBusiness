/**
 * refundEngine.js — the single, canonical place that ever calls Razorpay's
 * refund API or writes order.refund.status. Every refund-triggering flow
 * in the app (auto-refund on cancellation, admin-approves-a-customer's
 * refund-request, and the return-flow refund action) goes through
 * claimRefund()+executeGatewayRefund() here — never straight at Razorpay.
 *
 * WHY THIS EXISTS (production bug found and fixed):
 * Three call sites (orderController.js::processRefund,
 * orderController.js::processReturn, Paymentcontroller.js::processRefund)
 * each independently did read-order → check refund.status in JS → call
 * Razorpay → save. That "check-then-act" is NOT atomic — two concurrent
 * requests (an admin double-clicking Approve, a retry racing the original
 * attempt, or a customer cancelling at the same moment an admin approves
 * their separate refund request) can both read the same pre-write
 * refund.status, both pass the check, and both successfully call Razorpay
 * — a real double refund of the customer's money. claimRefund() closes
 * that window with a single atomic findOneAndUpdate: only the caller
 * whose filter still matches the CURRENT database state can flip
 * refund.status → "PROCESSING"; every other concurrent caller gets null
 * back and must not call Razorpay. This mirrors the atomic
 * findOneAndUpdate guard this codebase already uses for orderStatus
 * transitions (orderEngine.js::applyOrderTransition) — same technique,
 * applied to the field that actually moves money.
 */
import Razorpay from "razorpay";
import Order from "../models/Order.js";

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * Atomically claims the right to process this order's refund. Only
 * succeeds if refund.status is CURRENTLY (per the database, not a
 * possibly-stale in-memory object) one of `fromStatuses`. Returns the
 * freshly-claimed order (refund.status now "PROCESSING") or null if
 * someone else already claimed it / it isn't in a claimable state.
 */
const claimRefund = (orderId, fromStatuses, extraSet = {}) =>
    Order.findOneAndUpdate(
        { _id: orderId, "refund.status": { $in: fromStatuses } },
        { $set: { "refund.status": "PROCESSING", ...extraSet } },
        { new: true }
    );

// Releases a claim that turned out to be un-actionable (e.g. no
// razorpayPaymentId on the order) *before* Razorpay was ever called.
const releaseClaim = (orderId, toStatus) =>
    Order.findByIdAndUpdate(orderId, { $set: { "refund.status": toStatus } });

/**
 * Calls Razorpay for an order that has ALREADY been atomically claimed
 * (refund.status === "PROCESSING"). Never throws — always finalizes the
 * order to PROCESSED or FAILED so nothing is left stuck in PROCESSING,
 * and returns the outcome for the caller to relay to its client.
 */
const executeGatewayRefund = async (order, { amount, reason, actorId, ip, via = "REFUND" }) => {
    try {
        const result = await razorpay.payments.refund(order.payment.razorpayPaymentId, {
            amount: Math.round(amount * 100),
            notes: { orderId: order._id.toString(), reason: reason || "" },
        });
        await Order.findByIdAndUpdate(order._id, {
            $set: {
                "refund.status": "PROCESSED",
                "refund.processedAt": new Date(),
                "refund.razorpayRefundId": result.id,
                "refund.amount": amount,
                ...(actorId && { "refund.processedBy": actorId }),
                "payment.status": "REFUNDED",
            },
            $push: {
                paymentLogs: {
                    event: "REFUND_PROCESSED",
                    amount,
                    method: "RAZORPAY",
                    paymentId: result.id,
                    ip,
                    meta: { via },
                    at: new Date(),
                },
            },
        });
        return { success: true, refundId: result.id };
    } catch (err) {
        console.error(`[refundEngine] Razorpay refund failed for order ${order._id}:`, err.message);
        await Order.findByIdAndUpdate(order._id, {
            $set: { "refund.status": "FAILED" },
            $push: {
                paymentLogs: {
                    event: "REFUND_FAILED",
                    amount,
                    method: "RAZORPAY",
                    ip,
                    meta: { via, error: err.error?.description || err.message },
                    at: new Date(),
                },
            },
        });
        return { success: false, error: err.error?.description || err.message };
    }
};

/**
 * Auto-refund a cancelled order (called from cancelOrder + admin
 * force-cancel via updateOrderStatus). Non-throwing by design —
 * cancellation must always succeed even if the refund side fails; a
 * failed refund lands in refund.status:"FAILED" for the admin retry
 * queue rather than blocking the cancellation itself.
 */
export const refundOrderPayment = async (order, { reason = "Order cancelled", ip = "" } = {}) => {
    const gatewayEligible = order.payment?.method === "RAZORPAY" && order.payment?.razorpayPaymentId;
    if (!gatewayEligible || order.payment?.status !== "PAID") return { attempted: false };

    const claimed = await claimRefund(order._id, ["NONE", "REQUESTED", "FAILED"], {
        requested: true,
        requestedAt: new Date(),
        reason,
    });
    if (!claimed) return { attempted: false }; // already claimed/completed by another flow (e.g. a return refund beat this to it)

    const result = await executeGatewayRefund(claimed, {
        amount: claimed.totalAmount, reason, ip, via: "CANCELLATION",
    });
    return { attempted: true, ...result };
};

/**
 * Admin approves/rejects a customer's refund request (the requestRefund
 * flow). Single implementation shared by orderController.js and
 * Paymentcontroller.js's process-refund routes — see their doc-comments
 * for why two routes exist and why both must delegate here instead of
 * each calling Razorpay directly.
 */
export const adminDecideRefund = async ({ orderId, action, adminId, ip, adminNote = "" }) => {
    if (action === "reject") {
        const claimed = await Order.findOneAndUpdate(
            { _id: orderId, "refund.status": "REQUESTED" },
            {
                $set: {
                    "refund.status": "REJECTED",
                    "refund.adminNote": adminNote,
                    "refund.processedAt": new Date(),
                    ...(adminId && { "refund.processedBy": adminId }),
                },
            },
            { new: true }
        );
        if (!claimed) return { success: false, status: 400, message: "No pending refund request to reject" };
        return { success: true, order: claimed };
    }

    const claimed = await claimRefund(orderId, ["REQUESTED"]);
    if (!claimed) {
        return {
            success: false, status: 400,
            message: "Refund is not in a pending/requestable state (already processed, rejected, or no request exists)",
        };
    }

    if (claimed.payment?.method !== "RAZORPAY" || !claimed.payment?.razorpayPaymentId) {
        await releaseClaim(orderId, "FAILED");
        return { success: false, status: 400, message: "No Razorpay payment found on this order" };
    }

    // Ceiling at totalAmount even though nothing currently lets an admin
    // type a custom amount here — order.refund.amount is set once, by the
    // customer's own requestRefund call, always to order.totalAmount. This
    // is a defensive floor/ceiling, not a workaround for a live bug, so a
    // future body param never becomes a silent over-refund vector.
    const amount = Math.min(Number(claimed.refund?.amount) || claimed.totalAmount, claimed.totalAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
        await releaseClaim(orderId, "FAILED");
        return { success: false, status: 400, message: "Invalid refund amount" };
    }

    const result = await executeGatewayRefund(claimed, {
        amount, reason: claimed.refund?.reason, actorId: adminId, ip, via: "REFUND_REQUEST",
    });
    if (!result.success) return { success: false, status: 502, message: "Razorpay refund failed: " + result.error };
    return { success: true, refundId: result.refundId, amount };
};

/** Admin retries a refund that previously ended in FAILED. */
export const retryFailedRefund = async ({ orderId, adminId, ip }) => {
    const requeued = await Order.findOneAndUpdate(
        { _id: orderId, "refund.status": "FAILED" },
        { $set: { "refund.status": "REQUESTED" } },
        { new: true }
    );
    if (!requeued) return { success: false, status: 400, message: "Only a failed refund can be retried" };
    return adminDecideRefund({ orderId, action: "approve", adminId, ip });
};

/**
 * Return-flow refund — a different trigger (return approved/picked-up →
 * refund) from the customer-request flow above, so it doesn't go through
 * refund.status:"REQUESTED" first; claims straight from NONE/FAILED.
 * `amount` is a caller-supplied, already-capped-at-totalAmount value (the
 * return flow allows a partial, admin-typed refund amount) — this
 * function does not second-guess it, only guarantees the Razorpay call
 * itself can happen at most once.
 */
export const executeReturnRefund = async ({ order, amount, reason, adminId, ip }) => {
    if (order.payment?.method !== "RAZORPAY") return { success: false, status: 400, message: "Not a Razorpay payment" };
    if (!order.payment?.razorpayPaymentId) return { success: false, status: 400, message: "No Razorpay payment ID on order" };

    const claimed = await claimRefund(order._id, ["NONE", "REQUESTED", "FAILED"], {
        requested: true,
        requestedAt: order.refund?.requestedAt || new Date(),
        reason,
    });
    if (!claimed) return { success: false, status: 409, message: "A refund is already in progress or completed for this order" };

    const result = await executeGatewayRefund(claimed, { amount, reason, actorId: adminId, ip, via: "RETURN_FLOW" });
    if (!result.success) return { success: false, status: 502, message: "Razorpay refund failed: " + result.error };
    return { success: true, refundId: result.refundId };
};
