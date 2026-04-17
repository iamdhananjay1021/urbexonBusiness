/**
 * vendorEarnings.js — Production, fixed
 * Fixed: Proper order-based revenue calculation (no commission model)
 */
import Order from "../../models/Order.js";
import Product from "../../models/Product.js";
import Subscription from "../../models/vendorModels/Subscription.js";
import Notification from "../../models/Notification.js";
import Vendor from "../../models/vendorModels/Vendor.js";

// GET /api/vendor/earnings
export const getEarnings = async (req, res) => {
    try {
        const vendorId = req.vendor._id;
        const productIds = await Product.find({ vendorId }).distinct("_id");

        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        const [totals, monthTotals, lastMonthTotals, pendingTotals, recentOrders, subscription] = await Promise.all([
            // All-time delivered
            Order.aggregate([
                { $match: { "items.productId": { $in: productIds }, orderStatus: "DELIVERED" } },
                { $group: { _id: null, total: { $sum: { $ifNull: ["$totalAmount", 0] } }, count: { $sum: 1 } } },
            ]),
            // This month delivered
            Order.aggregate([
                { $match: { "items.productId": { $in: productIds }, orderStatus: "DELIVERED", createdAt: { $gte: thisMonthStart } } },
                { $group: { _id: null, total: { $sum: { $ifNull: ["$totalAmount", 0] } }, count: { $sum: 1 } } },
            ]),
            // Last month delivered (for growth comparison)
            Order.aggregate([
                { $match: { "items.productId": { $in: productIds }, orderStatus: "DELIVERED", createdAt: { $gte: lastMonthStart, $lt: thisMonthStart } } },
                { $group: { _id: null, total: { $sum: { $ifNull: ["$totalAmount", 0] } }, count: { $sum: 1 } } },
            ]),
            // Pending orders (placed/confirmed/packed — not yet delivered)
            Order.aggregate([
                { $match: { "items.productId": { $in: productIds }, orderStatus: { $in: ["PLACED", "CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY"] } } },
                { $group: { _id: null, total: { $sum: { $ifNull: ["$totalAmount", 0] } }, count: { $sum: 1 } } },
            ]),
            // Recent 20 delivered orders as transactions
            Order.find({ "items.productId": { $in: productIds }, orderStatus: "DELIVERED" })
                .sort({ createdAt: -1 })
                .limit(20)
                .select("invoiceNumber totalAmount createdAt payment.method payment.status customerName orderStatus _id")
                .lean(),
            Subscription.findOne({ vendorId }).lean(),
        ]);

        const t = totals[0] || { total: 0, count: 0 };
        const m = monthTotals[0] || { total: 0, count: 0 };
        const lm = lastMonthTotals[0] || { total: 0, count: 0 };
        const p = pendingTotals[0] || { total: 0, count: 0 };

        // Growth percentage vs last month
        const growth = lm.total > 0 ? ((m.total - lm.total) / lm.total) * 100 : m.total > 0 ? 100 : 0;

        res.json({
            success: true,
            earnings: {
                total: t.total,
                thisMonth: m.total,
                lastMonth: lm.total,
                totalOrders: t.count,
                monthOrders: m.count,
                pendingAmount: p.total,
                pendingOrders: p.count,
                growth: Math.round(growth * 10) / 10,
            },
            transactions: recentOrders.map(o => ({
                _id: o._id,
                invoiceNumber: o.invoiceNumber || `ORD-${String(o._id).slice(-6).toUpperCase()}`,
                amount: o.totalAmount || 0,
                date: o.createdAt,
                paymentMethod: o.payment?.method || "COD",
                paymentStatus: o.payment?.status || "PENDING",
                customerName: o.customerName || "Customer",
            })),
            subscription: subscription || null,
        });
    } catch (err) {
        console.error("[getEarnings]", err);
        res.status(500).json({ success: false, message: "Failed to fetch earnings" });
    }
};

// GET /api/vendor/earnings/weekly
export const getWeeklyEarnings = async (req, res) => {
    try {
        const vendorId = req.vendor._id;
        const productIds = await Product.find({ vendorId }).distinct("_id");

        // Last 7 days — single aggregation instead of 7 queries
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const dailyAgg = await Order.aggregate([
            {
                $match: {
                    "items.productId": { $in: productIds },
                    orderStatus: "DELIVERED",
                    createdAt: { $gte: sevenDaysAgo },
                },
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    orders: { $sum: 1 },
                    revenue: { $sum: { $ifNull: ["$totalAmount", 0] } },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        const aggMap = {};
        for (const d of dailyAgg) aggMap[d._id] = d;

        const weekly = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);
            const key = d.toISOString().split("T")[0];
            const match = aggMap[key];
            weekly.push({
                date: key,
                label: d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" }),
                orders: match?.orders || 0,
                revenue: match?.revenue || 0,
            });
        }

        res.json({ success: true, weekly });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to fetch weekly earnings" });
    }
};

// GET /api/vendor/subscription
export const getSubscription = async (req, res) => {
    try {
        const subscription = await Subscription.findOne({ vendorId: req.vendor._id }).lean();
        res.json({ success: true, subscription: subscription || null, plans: Subscription.PLANS || {} });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to fetch subscription" });
    }
};

// POST /api/vendor/subscription/request-change
export const requestPlanChange = async (req, res) => {
    try {
        const { plan, note } = req.body;
        const validPlans = Object.keys(Subscription.PLANS);
        if (!plan || !validPlans.includes(plan)) {
            return res.status(400).json({ success: false, message: `Invalid plan. Choose from: ${validPlans.join(", ")}` });
        }

        const vendorId = req.vendor._id;
        let subscription = await Subscription.findOne({ vendorId });

        // If same as current plan
        if (subscription?.plan === plan && subscription?.status === "active") {
            return res.status(400).json({ success: false, message: "You are already on this plan." });
        }

        // If already has a pending request
        if (subscription?.requestedPlan) {
            return res.status(400).json({ success: false, message: `You already have a pending request for "${subscription.requestedPlan}" plan. Cancel it first to request a different one.` });
        }

        if (!subscription) {
            // Create a new subscription doc in pending state
            const planConfig = Subscription.PLANS[plan];
            subscription = await Subscription.create({
                vendorId,
                plan: "starter",
                monthlyFee: 0,
                maxProducts: 10,
                status: "pending_payment",
                requestedPlan: plan,
                planChangeRequestedAt: new Date(),
                planChangeNote: (note || "").slice(0, 300),
            });
        } else {
            subscription.requestedPlan = plan;
            subscription.planChangeRequestedAt = new Date();
            subscription.planChangeNote = (note || "").slice(0, 300);
            await subscription.save();
        }

        // Get vendor name for notification
        const vendor = await Vendor.findById(vendorId).select("businessName").lean();
        const vendorName = vendor?.businessName || "A vendor";
        const planLabel = Subscription.PLANS[plan]?.label || plan;
        const currentLabel = subscription.plan ? (Subscription.PLANS[subscription.plan]?.label || subscription.plan) : "None";

        // Create admin notification
        await Notification.create({
            type: "plan_change",
            title: "Plan Change Request",
            message: `${vendorName} requested to change from ${currentLabel} to ${planLabel} plan.`,
            icon: "vendor",
            link: `/admin/vendors/${vendorId}`,
            meta: { vendorId, currentPlan: subscription.plan, requestedPlan: plan },
        });

        res.json({
            success: true,
            message: `Plan change request submitted! Admin will review and activate your "${planLabel}" plan.`,
            subscription: subscription.toObject(),
        });
    } catch (err) {
        console.error("[requestPlanChange]", err);
        res.status(500).json({ success: false, message: "Failed to submit plan change request." });
    }
};

// POST /api/vendor/subscription/cancel-request
export const cancelPlanChangeRequest = async (req, res) => {
    try {
        const subscription = await Subscription.findOne({ vendorId: req.vendor._id });
        if (!subscription?.requestedPlan) {
            return res.status(400).json({ success: false, message: "No pending plan change request." });
        }

        subscription.requestedPlan = null;
        subscription.planChangeRequestedAt = null;
        subscription.planChangeNote = "";
        await subscription.save();

        res.json({ success: true, message: "Plan change request cancelled.", subscription: subscription.toObject() });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to cancel request." });
    }
};
