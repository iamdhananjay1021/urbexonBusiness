/**
 * vendorSubscriptionPayment.js
 * ─────────────────────────────────────────────────────────────
 * Secure subscription payment flow via Razorpay.
 *
 * Flow:
 *   1. Vendor selects plan → createSubscriptionOrder (Razorpay order created)
 *   2. Vendor pays via Razorpay checkout
 *   3. Frontend sends payment response → verifySubscriptionPayment
 *   4. Server verifies HMAC signature
 *   5. ONLY on verified success → subscription activates
 *   6. If payment fails → subscription stays inactive, retry allowed
 *
 * Security:
 *   • Frontend amount IGNORED — server calculates from PLANS config
 *   • HMAC-SHA256 signature verification mandatory
 *   • Idempotent — duplicate payment IDs rejected
 *   • No subscription activation without verified payment
 */

import Razorpay from "razorpay";
import crypto from "crypto";
import Subscription from "../../models/vendorModels/Subscription.js";
import Vendor from "../../models/vendorModels/Vendor.js";
import Notification from "../../models/Notification.js";

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const PLANS = Subscription.PLANS;

// ══════════════════════════════════════════════════════
// 1. GET PLANS — public info for plan selection
// ══════════════════════════════════════════════════════
export const getSubscriptionPlans = async (req, res) => {
    try {
        const sub = await Subscription.findOne({ vendorId: req.vendor._id }).lean();
        res.json({
            success: true,
            plans: PLANS,
            currentSubscription: sub || null,
        });
    } catch (err) {
        console.error("[getSubscriptionPlans]", err);
        res.status(500).json({ success: false, message: "Failed to fetch plans" });
    }
};

// ══════════════════════════════════════════════════════
// 2. CREATE RAZORPAY ORDER for subscription payment
// ══════════════════════════════════════════════════════
export const createSubscriptionOrder = async (req, res) => {
    try {
        const { plan, months = 1 } = req.body;
        const vendorId = req.vendor._id;

        // Validate plan
        if (!plan || !PLANS[plan]) {
            return res.status(400).json({
                success: false,
                message: `Invalid plan. Choose from: ${Object.keys(PLANS).join(", ")}`,
            });
        }

        const planConfig = PLANS[plan];
        const monthCount = Math.min(Math.max(Number(months) || 1, 1), 12);

        // Starter plan is free — activate directly without payment
        if (planConfig.monthlyFee === 0) {
            return res.status(400).json({
                success: false,
                message: "Starter plan is free. Use the plan change request instead.",
            });
        }

        const amount = planConfig.monthlyFee * monthCount;

        // Create Razorpay order — server-side amount calculation
        const rpOrder = await razorpay.orders.create({
            amount: Math.round(amount * 100), // paise
            currency: "INR",
            receipt: `sub_${vendorId}_${Date.now()}`,
            notes: {
                vendorId: vendorId.toString(),
                plan,
                months: monthCount,
                type: "subscription",
            },
        });

        // Store pending payment on subscription doc
        await Subscription.findOneAndUpdate(
            { vendorId },
            {
                vendorId,
                pendingPayment: {
                    razorpayOrderId: rpOrder.id,
                    plan,
                    months: monthCount,
                    amount,
                    createdAt: new Date(),
                },
            },
            { upsert: true, new: true }
        );

        res.json({
            success: true,
            order: {
                id: rpOrder.id,
                amount: rpOrder.amount,
                currency: rpOrder.currency,
            },
            plan: {
                name: plan,
                label: planConfig.label,
                monthlyFee: planConfig.monthlyFee,
                months: monthCount,
                totalAmount: amount,
                maxProducts: planConfig.maxProducts,
            },
        });
    } catch (err) {
        console.error("[createSubscriptionOrder]", err);
        res.status(500).json({ success: false, message: "Failed to create payment order" });
    }
};

// ══════════════════════════════════════════════════════
// 3. VERIFY PAYMENT — activates subscription ONLY on success
// ══════════════════════════════════════════════════════
export const verifySubscriptionPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
        } = req.body;

        const vendorId = req.vendor._id;

        // ── Validate required fields ─────────────────────────
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: "Missing payment verification data",
            });
        }

        // ── Step 1: Verify HMAC signature ────────────────────
        const expectedSig = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        if (!crypto.timingSafeEqual(Buffer.from(expectedSig, "hex"), Buffer.from(razorpay_signature, "hex"))) {
            // Log failed attempt
            await logPaymentAttempt(vendorId, razorpay_order_id, razorpay_payment_id, "failed", "Signature verification failed");
            return res.status(400).json({
                success: false,
                message: "Payment verification failed. Signature mismatch.",
            });
        }

        // ── Step 2: Fetch subscription with pending payment ──
        const sub = await Subscription.findOne({ vendorId });
        if (!sub) {
            return res.status(404).json({ success: false, message: "Subscription record not found" });
        }

        // Verify this order ID matches the pending payment
        if (sub.pendingPayment?.razorpayOrderId !== razorpay_order_id) {
            return res.status(400).json({
                success: false,
                message: "Order ID does not match pending payment",
            });
        }

        // ── Step 3: Idempotency — check duplicate payment ───
        const existingPayment = sub.payments.find(
            p => p.razorpayPaymentId === razorpay_payment_id
        );
        if (existingPayment) {
            return res.json({
                success: true,
                message: "Payment already verified",
                subscription: sub.toObject(),
                duplicate: true,
            });
        }

        // ── Step 4: Verify Razorpay order amount ─────────────
        let rpOrder;
        try {
            rpOrder = await razorpay.orders.fetch(razorpay_order_id);
        } catch {
            console.warn("[verifySubscriptionPayment] Could not fetch Razorpay order for amount check");
        }

        if (rpOrder) {
            const expectedAmount = Math.round(sub.pendingPayment.amount * 100);
            if (Math.abs(rpOrder.amount - expectedAmount) > 100) {
                return res.status(400).json({
                    success: false,
                    message: "Payment amount mismatch. Contact support.",
                });
            }
        }

        // ── Step 5: ACTIVATE SUBSCRIPTION ────────────────────
        const { plan, months, amount } = sub.pendingPayment;
        const planConfig = PLANS[plan];
        const now = new Date();
        const expiry = new Date(now);
        expiry.setMonth(expiry.getMonth() + months);

        sub.plan = plan;
        sub.monthlyFee = planConfig.monthlyFee;
        sub.maxProducts = planConfig.maxProducts;
        sub.status = "active";
        sub.startDate = now;
        sub.expiryDate = expiry;
        sub.nextDueDate = expiry;
        sub.lastPaymentDate = now;
        sub.isTrialActive = false;

        // Record payment
        sub.payments.push({
            amount,
            date: now,
            method: "razorpay",
            reference: razorpay_payment_id,
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            months,
            status: "success",
        });

        // Clear pending payment & plan change request
        sub.pendingPayment = { razorpayOrderId: null, plan: null, months: null, amount: null, createdAt: null };
        sub.requestedPlan = null;
        sub.planChangeRequestedAt = null;
        sub.planChangeNote = "";

        await sub.save();

        // ── Step 6: Sync embedded subscription on vendor doc ─
        await Vendor.findByIdAndUpdate(vendorId, {
            "subscription.plan": plan,
            "subscription.startDate": now,
            "subscription.expiryDate": expiry,
            "subscription.isActive": true,
            "subscription.transactionId": razorpay_payment_id,
        });

        // ── Step 7: Admin notification ───────────────────────
        const vendor = await Vendor.findById(vendorId).select("shopName").lean();
        await Notification.create({
            type: "subscription_activated",
            title: "Subscription Activated",
            message: `${vendor?.shopName || "A vendor"} activated ${planConfig.label} plan (${months} month${months > 1 ? "s" : ""}) — ₹${amount} paid via Razorpay.`,
            icon: "vendor",
            link: `/admin/vendors/${vendorId}`,
            meta: { vendorId, plan, amount, paymentId: razorpay_payment_id },
        });

        res.json({
            success: true,
            message: `${planConfig.label} plan activated for ${months} month${months > 1 ? "s" : ""}!`,
            subscription: sub.toObject(),
        });
    } catch (err) {
        console.error("[verifySubscriptionPayment]", err);
        res.status(500).json({ success: false, message: "Payment verification failed" });
    }
};

// ══════════════════════════════════════════════════════
// 4. HANDLE FAILED PAYMENT — mark payment failed, keep inactive
// ══════════════════════════════════════════════════════
export const handleSubscriptionPaymentFailure = async (req, res) => {
    try {
        const { razorpay_order_id, error_code, error_description } = req.body;
        const vendorId = req.vendor._id;

        const sub = await Subscription.findOne({ vendorId });
        if (!sub) {
            return res.status(404).json({ success: false, message: "Subscription not found" });
        }

        // Log the failed payment
        sub.payments.push({
            amount: sub.pendingPayment?.amount || 0,
            date: new Date(),
            method: "razorpay",
            reference: `FAILED-${razorpay_order_id || "unknown"}`,
            razorpayOrderId: razorpay_order_id || null,
            months: sub.pendingPayment?.months || 1,
            status: "failed",
        });

        // DO NOT activate — subscription stays as-is
        // Clear the pending payment so they can retry
        sub.pendingPayment = { razorpayOrderId: null, plan: null, months: null, amount: null, createdAt: null };
        await sub.save();

        res.json({
            success: true,
            message: "Payment failed. You can retry anytime.",
            subscription: sub.toObject(),
        });
    } catch (err) {
        console.error("[handleSubscriptionPaymentFailure]", err);
        res.status(500).json({ success: false, message: "Failed to record payment failure" });
    }
};

// ══════════════════════════════════════════════════════
// 5. GET PAYMENT HISTORY
// ══════════════════════════════════════════════════════
export const getSubscriptionPaymentHistory = async (req, res) => {
    try {
        const sub = await Subscription.findOne({ vendorId: req.vendor._id })
            .select("payments plan status expiryDate startDate pendingPayment isTrialActive trialEndsAt")
            .lean();

        if (!sub) {
            return res.json({ success: true, payments: [], subscription: null });
        }

        // Sort payments newest first
        const payments = (sub.payments || []).sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json({
            success: true,
            payments,
            subscription: {
                plan: sub.plan,
                status: sub.status,
                startDate: sub.startDate,
                expiryDate: sub.expiryDate,
                isTrialActive: sub.isTrialActive,
                trialEndsAt: sub.trialEndsAt,
                hasPendingPayment: !!sub.pendingPayment?.razorpayOrderId,
            },
        });
    } catch (err) {
        console.error("[getSubscriptionPaymentHistory]", err);
        res.status(500).json({ success: false, message: "Failed to fetch payment history" });
    }
};

// ── Helper: Log payment attempt for audit ─────────────
async function logPaymentAttempt(vendorId, orderId, paymentId, status, reason) {
    try {
        await Subscription.findOneAndUpdate(
            { vendorId },
            {
                $push: {
                    payments: {
                        amount: 0,
                        date: new Date(),
                        method: "razorpay",
                        reference: `${status.toUpperCase()}-${orderId || "unknown"}-${reason}`,
                        razorpayOrderId: orderId,
                        razorpayPaymentId: paymentId,
                        months: 0,
                        status,
                    },
                },
            }
        );
    } catch {
        // Audit log failure should not break the main flow
    }
}
