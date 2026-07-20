/**
 * couponController.js — customer-facing preview endpoints + admin CRUD.
 *
 * validateCoupon/getActiveCoupons are now thin wrappers over the single
 * canonical engine (services/couponEngine.js) — no eligibility/discount
 * logic lives in this file anymore. Response shapes are kept identical to
 * before so no existing frontend caller needs to change.
 */
import Coupon from "../models/Coupon.js";
import CouponUsage from "../models/CouponUsage.js";
import User from "../models/User.js";
import * as couponEngine from "../services/couponEngine.js";

const buildContext = (req) => ({
    userId: req.user?._id,
    module: "ORDER",
    orderMode: req.body.orderType,
    items: Array.isArray(req.body.items)
        ? req.body.items.map((i) => ({
            productId: i.productId, category: i.category, brand: i.brand,
            vendorId: i.vendorId, qty: i.qty, price: i.price,
        }))
        : undefined,
    itemsTotal: Number(req.body.orderTotal) || 0,
    state: req.body.state,
    pincode: req.body.pincode,
});

// POST /api/coupons/validate  (user validates at checkout)
export const validateCoupon = async (req, res) => {
    try {
        const { code } = req.body;
        if (!code?.trim()) return res.status(400).json({ success: false, message: "Coupon code required" });

        const result = await couponEngine.validateCouponForContext({ code, context: buildContext(req) });
        if (!result.valid) {
            return res.status(result.coupon ? 400 : 404).json({ success: false, message: result.reason || "Invalid or expired coupon code" });
        }

        const { coupon, discount } = result;
        const orderTotal = Number(req.body.orderTotal) || 0;
        res.json({
            success: true,
            valid: true,
            couponId: coupon._id,
            code: coupon.code,
            description: coupon.description,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            discount,
            freeShipping: coupon.discountType === "FREE_SHIPPING",
            minOrderValue: coupon.minOrderValue || 0,
            finalTotal: Math.max(0, orderTotal - discount),
        });
    } catch (err) {
        console.error("[validateCoupon]", err);
        res.status(500).json({ success: false, message: "Failed to validate coupon" });
    }
};

// GET /api/coupons/active  (customer — browsable list of coupons they can still use)
export const getActiveCoupons = async (req, res) => {
    try {
        const context = { userId: req.user?._id, module: "ORDER" };
        const ranked = await couponEngine.getEligibleCoupons(context);

        // Same contract as before: only genuinely-usable coupons, sensitive
        // fields (usedBy/usedCount/usageLimit and the new targeting/limit
        // internals) stripped — this is a browse list, not an admin view.
        const coupons = ranked
            .filter((r) => r.eligible)
            .map((r) => ({
                _id: r.coupon._id,
                code: r.coupon.code,
                description: r.coupon.description,
                discountType: r.coupon.discountType,
                discountValue: r.coupon.discountValue,
                maxDiscount: r.coupon.maxDiscount,
                minOrderValue: r.coupon.minOrderValue,
                applicableTo: r.coupon.applicableTo,
                expiresAt: r.coupon.expiresAt,
            }));

        res.json({ success: true, coupons });
    } catch (err) {
        console.error("[getActiveCoupons]", err);
        res.status(500).json({ success: false, message: "Failed to load coupons" });
    }
};

// POST /api/coupons/eligible — cart-context ranked coupons for the cart/
// checkout "Available coupons" panel. Unlike /active, this ALSO returns
// near-eligible (ineligible-with-reason) entries so the UI can show
// "Add ₹120 more to unlock SAVE10" instead of just hiding it.
export const couponEligible = async (req, res) => {
    try {
        const { items, orderMode, itemsTotal, state, pincode } = req.body;
        const context = {
            userId: req.user?._id,
            module: "ORDER",
            orderMode,
            items: Array.isArray(items)
                ? items.map((i) => ({ productId: i.productId, category: i.category, brand: i.brand, vendorId: i.vendorId, qty: i.qty, price: i.price }))
                : undefined,
            itemsTotal: Number(itemsTotal) || 0,
            state,
            pincode,
        };
        const ranked = await couponEngine.getEligibleCoupons(context);
        res.json({
            success: true,
            coupons: ranked.map((r) => ({
                couponId: r.coupon._id,
                code: r.coupon.code,
                description: r.coupon.description,
                discountType: r.coupon.discountType,
                eligible: r.eligible,
                reason: r.reason,
                discountPreview: r.discountPreview,
                autoApply: !!r.coupon.autoApply,
            })),
        });
    } catch (err) {
        console.error("[couponEligible]", err);
        res.status(500).json({ success: false, message: "Failed to load eligible coupons" });
    }
};

// ─── ADMIN CRUD ───────────────────────────────────────────

const ADMIN_WHITELIST = [
    "code", "description", "discountType", "discountValue", "maxDiscount", "minOrderValue",
    "usageLimit", "userUsageLimit", "dailyRedemptionLimit", "firstOrderOnly",
    "activeHours", "minItemQuantity", "categoryMinSpend", "minCustomerOrders", "minCustomerSpend",
    "applicableTo", "couponModule", "applicableSubscriptionPlans",
    "priority", "isStackable", "isExclusive", "autoApply",
    "applicableCategories", "applicableBrands", "applicableProducts", "applicableVendors", "applicableCollections",
    "excludedProducts", "excludedCategories", "excludedVendors", "excludedUsers", "excludedBrands",
    "applicableStates", "applicablePincodes",
    "expiresAt", "isActive",
];

const buildCouponPayload = (body) => {
    const updates = {};
    for (const key of ADMIN_WHITELIST) {
        if (body[key] !== undefined) updates[key] = body[key];
    }
    if (updates.code) updates.code = String(updates.code).trim().toUpperCase();
    if (updates.description !== undefined) updates.description = String(updates.description).trim();
    if (updates.discountValue !== undefined) updates.discountValue = Number(updates.discountValue);
    if (updates.maxDiscount !== undefined) updates.maxDiscount = updates.maxDiscount === "" || updates.maxDiscount === null ? null : Number(updates.maxDiscount);
    if (updates.minOrderValue !== undefined) updates.minOrderValue = Number(updates.minOrderValue) || 0;
    if (updates.usageLimit !== undefined) updates.usageLimit = updates.usageLimit === "" || updates.usageLimit === null ? null : Number(updates.usageLimit);
    if (updates.userUsageLimit !== undefined) updates.userUsageLimit = updates.userUsageLimit === "" || updates.userUsageLimit === null ? null : Number(updates.userUsageLimit);
    if (updates.dailyRedemptionLimit !== undefined) updates.dailyRedemptionLimit = updates.dailyRedemptionLimit === "" || updates.dailyRedemptionLimit === null ? null : Number(updates.dailyRedemptionLimit);
    if (updates.priority !== undefined) updates.priority = Number(updates.priority) || 0;
    if (updates.minItemQuantity !== undefined) updates.minItemQuantity = Number(updates.minItemQuantity) || 0;
    if (updates.categoryMinSpend !== undefined) updates.categoryMinSpend = Number(updates.categoryMinSpend) || 0;
    if (updates.minCustomerOrders !== undefined) updates.minCustomerOrders = Number(updates.minCustomerOrders) || 0;
    if (updates.minCustomerSpend !== undefined) updates.minCustomerSpend = Number(updates.minCustomerSpend) || 0;
    if (updates.activeHours !== undefined) {
        const h = updates.activeHours || {};
        updates.activeHours = { start: h.start || null, end: h.end || null };
    }
    if (updates.expiresAt !== undefined) updates.expiresAt = updates.expiresAt ? new Date(updates.expiresAt) : null;
    for (const bool of ["isStackable", "isExclusive", "autoApply", "isActive", "firstOrderOnly"]) {
        if (updates[bool] !== undefined) updates[bool] = updates[bool] === true || updates[bool] === "true";
    }
    return updates;
};

// GET /api/coupons/admin
export const adminGetCoupons = async (req, res) => {
    try {
        const { page = 1, limit = 20, search } = req.query;
        const filter = {};
        if (search) {
            const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.code = { $regex: escaped, $options: "i" };
        }
        const skip = (Number(page) - 1) * Number(limit);
        const [coupons, total] = await Promise.all([
            Coupon.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
            Coupon.countDocuments(filter),
        ]);

        // Basic usage stats for this page only — cheap (≤20 coupon ids,
        // indexed), gives the admin list real redemption numbers at a
        // glance. The full breakdown (top coupons/customers, trend over
        // time) is adminGetCouponAnalytics below. Merged onto each row.
        const couponIds = coupons.map((c) => c._id);
        const stats = couponIds.length
            ? await CouponUsage.aggregate([
                { $match: { couponId: { $in: couponIds }, status: "APPLIED" } },
                { $group: { _id: "$couponId", totalDiscountGiven: { $sum: "$discountAmount" }, redemptions: { $sum: 1 } } },
            ])
            : [];
        const statsMap = new Map(stats.map((s) => [String(s._id), s]));
        const withStats = coupons.map((c) => ({
            ...c,
            totalDiscountGiven: statsMap.get(String(c._id))?.totalDiscountGiven || 0,
            redemptions: statsMap.get(String(c._id))?.redemptions || 0,
        }));

        res.json({ coupons: withStats, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
    } catch (err) {
        console.error("[adminGetCoupons]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};

// GET /api/coupons/admin/analytics — Coupon Engine dashboard. Everything
// here reads from the CouponUsage ledger (services/couponEngine.js writes
// it on every markCouponUsage call) — pure read-side, no schema changes.
export const adminGetCouponAnalytics = async (req, res) => {
    try {
        const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
        const since = new Date(Date.now() - days * 86400000);
        const baseMatch = { createdAt: { $gte: since }, status: "APPLIED" };

        const [summaryAgg, topCoupons, topCustomersRaw, byDay, byModule, totalCouponsCreated] = await Promise.all([
            CouponUsage.aggregate([
                { $match: baseMatch },
                { $group: { _id: null, totalRedemptions: { $sum: 1 }, totalDiscountGiven: { $sum: "$discountAmount" }, uniqueCoupons: { $addToSet: "$couponId" } } },
            ]),
            CouponUsage.aggregate([
                { $match: baseMatch },
                { $group: { _id: "$couponId", code: { $first: "$code" }, redemptions: { $sum: 1 }, totalDiscount: { $sum: "$discountAmount" } } },
                { $sort: { totalDiscount: -1 } },
                { $limit: 10 },
            ]),
            CouponUsage.aggregate([
                { $match: baseMatch },
                { $group: { _id: "$userId", redemptions: { $sum: 1 }, totalDiscount: { $sum: "$discountAmount" } } },
                { $sort: { totalDiscount: -1 } },
                { $limit: 10 },
            ]),
            CouponUsage.aggregate([
                { $match: baseMatch },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, redemptions: { $sum: 1 }, discount: { $sum: "$discountAmount" } } },
                { $sort: { _id: 1 } },
            ]),
            CouponUsage.aggregate([
                { $match: baseMatch },
                { $group: { _id: "$module", redemptions: { $sum: 1 }, totalDiscount: { $sum: "$discountAmount" } } },
            ]),
            Coupon.countDocuments({}),
        ]);

        // Populate top-customer display names — the ledger only stores userId.
        const userIds = topCustomersRaw.map((c) => c._id).filter(Boolean);
        const users = userIds.length
            ? await User.find({ _id: { $in: userIds } }).select("name email").lean()
            : [];
        const userMap = new Map(users.map((u) => [String(u._id), u]));
        const topCustomers = topCustomersRaw.map((c) => ({
            userId: c._id,
            name: userMap.get(String(c._id))?.name || "Deleted user",
            email: userMap.get(String(c._id))?.email || "",
            redemptions: c.redemptions,
            totalDiscount: c.totalDiscount,
        }));

        const summary = summaryAgg[0] || { totalRedemptions: 0, totalDiscountGiven: 0, uniqueCoupons: [] };

        res.json({
            success: true,
            days,
            summary: {
                totalRedemptions: summary.totalRedemptions,
                totalDiscountGiven: summary.totalDiscountGiven,
                uniqueCouponsUsed: summary.uniqueCoupons.length,
                avgDiscount: summary.totalRedemptions ? Math.round(summary.totalDiscountGiven / summary.totalRedemptions) : 0,
                totalCouponsCreated,
            },
            topCoupons: topCoupons.map((c) => ({ couponId: c._id, code: c.code, redemptions: c.redemptions, totalDiscount: c.totalDiscount })),
            topCustomers,
            byDay: byDay.map((d) => ({ date: d._id, redemptions: d.redemptions, discount: d.discount })),
            byModule: byModule.map((m) => ({ module: m._id, redemptions: m.redemptions, totalDiscount: m.totalDiscount })),
        });
    } catch (err) {
        console.error("[adminGetCouponAnalytics]", err);
        res.status(500).json({ success: false, message: "Failed to load coupon analytics" });
    }
};

// POST /api/coupons/admin
export const adminCreateCoupon = async (req, res) => {
    try {
        const payload = buildCouponPayload(req.body);
        if (!payload.code?.trim() || (payload.discountType !== "FREE_SHIPPING" && !payload.discountValue))
            return res.status(400).json({ success: false, message: "Code and discount value required" });
        if ((payload.discountType || "PERCENT") === "PERCENT" && Number(payload.discountValue) > 100)
            return res.status(400).json({ success: false, message: "Percentage discount cannot exceed 100%" });

        const coupon = await Coupon.create({ ...payload, createdBy: req.user._id });
        res.status(201).json({ success: true, coupon });
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ success: false, message: "Coupon code already exists" });
        res.status(500).json({ success: false, message: err.message || "Failed to create coupon" });
    }
};

// PUT /api/coupons/admin/:id
export const adminUpdateCoupon = async (req, res) => {
    try {
        const updates = buildCouponPayload(req.body);

        // Fetch existing coupon first so we validate against the *effective*
        // discountType/discountValue after this update, not just whatever
        // fields happened to be in the request body.
        const existing = await Coupon.findById(req.params.id);
        if (!existing) return res.status(404).json({ success: false, message: "Coupon not found" });

        const effectiveType = updates.discountType ?? existing.discountType;
        const effectiveValue = updates.discountValue !== undefined ? Number(updates.discountValue) : existing.discountValue;
        if (effectiveType === "PERCENT" && effectiveValue > 100) {
            return res.status(400).json({ success: false, message: "Percentage discount cannot exceed 100%" });
        }

        const coupon = await Coupon.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
        res.json({ success: true, coupon });
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ success: false, message: "Coupon code already exists" });
        res.status(500).json({ success: false, message: "Failed to update" });
    }
};

// DELETE /api/coupons/admin/:id
export const adminDeleteCoupon = async (req, res) => {
    try {
        await Coupon.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed" });
    }
};

// PATCH /api/coupons/admin/:id/toggle
export const adminToggleCoupon = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) return res.status(404).json({ success: false, message: "Not found" });
        coupon.isActive = !coupon.isActive;
        await coupon.save();
        res.json({ success: true, isActive: coupon.isActive });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed" });
    }
};
