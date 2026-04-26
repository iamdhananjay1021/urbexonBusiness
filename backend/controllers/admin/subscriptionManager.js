/**
 * subscriptionManager.js - Admin subscription management
 */
import Subscription from "../../models/vendorModels/Subscription.js";
import Vendor from "../../models/vendorModels/Vendor.js";

const PLAN_CONFIG = {
    basic: { monthlyFee: 499, maxProducts: 30 },
    standard: { monthlyFee: 999, maxProducts: 100 },
    premium: { monthlyFee: 1999, maxProducts: 500 },
};

// GET /api/admin/subscriptions
export const getAllSubscriptions = async (req, res) => {
    try {
        const subs = await Subscription.find()
            .populate("vendorId", "shopName ownerName email")
            .sort({ createdAt: -1 })
            .lean();
        res.json({ success: true, subscriptions: subs });
    } catch (err) {
        console.error("[getAllSubscriptions]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};

// POST /api/admin/subscriptions/activate
// FIX #2 + #3: anti-race findOneAndUpdate + idempotency guard
export const activateSubscription = async (req, res) => {
    try {
        const { vendorId, plan, months = 1 } = req.body;
        if (!PLAN_CONFIG[plan]) return res.status(400).json({ success: false, message: "Invalid plan" });

        const numMonths = Number(months);
        if (!Number.isInteger(numMonths) || numMonths < 1 || numMonths > 24)
            return res.status(400).json({ success: false, message: "months must be an integer between 1 and 24" });

        const vendor = await Vendor.findById(vendorId);
        if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

        const now = new Date();
        const expiry = new Date(now);
        expiry.setMonth(expiry.getMonth() + numMonths);

        // FIX #2 + #3 — Single atomic upsert, no findOne→create race possible.
        // If an active subscription for this vendor already exists with same plan
        // and has not expired, return early (idempotency).
        const existing = await Subscription.findOne({ vendorId }).lean();
        if (existing &&
            existing.status === "active" &&
            existing.plan === plan &&
            existing.expiryDate > now
        ) {
            return res.status(409).json({
                success: false,
                message: `Vendor already has an active ${plan} plan until ${existing.expiryDate.toISOString().slice(0, 10)}`,
            });
        }

        const sub = await Subscription.findOneAndUpdate(
            { vendorId },
            {
                vendorId,
                plan,
                monthlyFee: PLAN_CONFIG[plan].monthlyFee,
                maxProducts: PLAN_CONFIG[plan].maxProducts,
                status: "active",
                startDate: now,
                expiryDate: expiry,
                nextDueDate: expiry,
                lastPaymentDate: now,
                $push: {
                    payments: {
                        amount: PLAN_CONFIG[plan].monthlyFee * numMonths,
                        method: "manual",
                        months: numMonths,
                        date: now,
                        reference: `ADMIN-${Date.now()}`,
                    },
                },
            },
            { upsert: true, new: true }
        );

        vendor.subscription = { plan, status: "active", expiryDate: expiry };
        await vendor.save();

        res.json({ success: true, subscription: sub });
    } catch (err) {
        console.error("[activateSubscription]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};

// PATCH /api/admin/subscriptions/:id/expire
export const expireSubscription = async (req, res) => {
    try {
        // FIX #3 — Idempotency: only update if not already expired
        const sub = await Subscription.findOneAndUpdate(
            { _id: req.params.id, status: { $ne: "expired" } },
            { status: "expired" },
            { new: true }
        );
        if (!sub) {
            const existing = await Subscription.findById(req.params.id).lean();
            if (!existing) return res.status(404).json({ success: false, message: "Not found" });
            return res.json({ success: true, subscription: existing, message: "Already expired" });
        }
        res.json({ success: true, subscription: sub });
    } catch (err) {
        console.error("[expireSubscription]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};