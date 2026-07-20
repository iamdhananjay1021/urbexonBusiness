/**
 * couponEngine.js — the single, canonical coupon validation/application
 * service.
 *
 * Before this file existed, THREE separate implementations of "is this
 * coupon valid, and what's the discount" had drifted apart:
 *   - controllers/couponController.js::validateCoupon (preview, hard-errors)
 *   - services/pricing.js::applyCoupon (authoritative, silently no-ops)
 *   - validations/orderValidations.js::validateCoupon (dead — checked
 *     fields that never existed on the schema: couponCode/expiryDate/
 *     usageCount/userUsageLimit)
 * Every caller now goes through this one module instead. There is
 * deliberately no second code path anywhere that re-implements eligibility
 * or discount math.
 */
import mongoose from "mongoose";
import Coupon from "../models/Coupon.js";
import CouponUsage from "../models/CouponUsage.js";
import Collection from "../models/Collection.js";
import Order from "../models/Order.js";
import { buildCollectionFilter } from "./collectionService.js";
import Product from "../models/Product.js";
import { getCache, setCache } from "../utils/Cache.js";

const safeGetCache = async (key) => { try { return await getCache(key); } catch { return null; } };
const safeSetCache = async (key, val, ttl) => { try { await setCache(key, val, ttl); } catch { /* cache down */ } };

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const todayIST = () => new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
const nowHHMM_IST = () => new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(11, 16);

const norm = (s) => String(s || "").trim().toLowerCase();
const idsMatch = (a, b) => String(a) === String(b);

/* "HH:MM" strings compare correctly with plain string comparison (zero-
   padded, fixed width). Supports an overnight window (start > end, e.g.
   22:00-02:00) as well as a same-day window (start <= end, e.g. 18:00-20:00). */
const isWithinTimeWindow = (start, end, now) => {
    if (start <= end) return now >= start && now <= end;
    return now >= start || now <= end;
};

/* ── Active-coupon fetch (cached — coupon set changes rarely relative to
   checkout traffic; same safeGetCache/safeSetCache pattern already used by
   collectionController.js) ── */
export const buildActiveCouponFilter = (now = new Date()) => ({
    isActive: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
});

export const getActiveCoupons = async () => {
    const cacheKey = "coupons:active:all";
    const cached = await safeGetCache(cacheKey);
    if (cached) return cached.map((c) => ({ ...c, _id: new mongoose.Types.ObjectId(c._id) }));

    const coupons = await Coupon.find(buildActiveCouponFilter()).lean();
    await safeSetCache(cacheKey, coupons, 60);
    return coupons;
};

/* ── Discount math — identical to the old applyCoupon's math.
   FREE_SHIPPING intentionally returns 0 here: zeroing the delivery charge
   is the caller's (pricing.js) job, not this function's — this function
   only ever answers "how much off itemsTotal," and shipping isn't part of
   itemsTotal. ── */
export const calcDiscount = (coupon, itemsTotal) => {
    if (coupon.discountType === "FREE_SHIPPING") return 0;
    if (coupon.discountType === "PERCENT") {
        let discount = Math.round((itemsTotal * coupon.discountValue) / 100);
        if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
        return discount;
    }
    // FLAT
    return Math.min(coupon.discountValue, itemsTotal);
};

/* ── Eligibility — every restriction dimension checked in one place. ──
 * context = {
 *   userId, module: "ORDER"|"VENDOR_SUBSCRIPTION", orderMode: "ecommerce"|"urbexon_hour",
 *   items: [{productId, category, brand, vendorId, qty, price}] (optional — see below),
 *   itemsTotal, state, pincode, subscriptionPlan, subscriptionMonths
 * }
 * `items`/`state`/`pincode` are OPTIONAL. When absent (e.g. the "browse all
 * coupons" list on GET /coupons/active, which has no cart/location
 * context), the corresponding restriction dimensions are SKIPPED rather
 * than treated as a failure — a product-scoped coupon should still be
 * *shown* on a browse page, not hidden just because that page doesn't know
 * the cart yet. Real cart-context calls (checkout, /coupons/eligible)
 * always pass items/state/pincode, so the restriction is genuinely
 * enforced wherever it matters.
 */
export const isCouponEligible = async (coupon, context = {}) => {
    const now = new Date();

    if (!coupon.isActive) return { eligible: false, reason: "This coupon is no longer active" };
    if (coupon.expiresAt && now > new Date(coupon.expiresAt)) return { eligible: false, reason: "This coupon has expired" };

    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
        return { eligible: false, reason: "This coupon has reached its usage limit" };
    }

    if (context.userId && coupon.userUsageLimit !== null && coupon.userUsageLimit !== undefined) {
        const usedByThisUser = (coupon.usedBy || []).filter((u) => idsMatch(u.userId, context.userId)).length;
        if (usedByThisUser >= coupon.userUsageLimit) {
            return { eligible: false, reason: "You've already used this coupon the maximum number of times" };
        }
    }

    if (coupon.dailyRedemptionLimit != null) {
        const today = todayIST();
        if (coupon.dailyUsage?.date === today && coupon.dailyUsage.count >= coupon.dailyRedemptionLimit) {
            return { eligible: false, reason: "This coupon's daily redemption limit has been reached — try again tomorrow" };
        }
    }

    // "Has this user EVER placed an order" — checked regardless of that
    // order's status (including cancelled ones). Deliberately not
    // restricted to non-cancelled: a user who places-then-cancels has
    // already been through the funnel once, and excluding cancelled
    // orders would make this trivially gameable (place a throwaway order,
    // cancel it, still look like a first-timer). Only checked when
    // context.userId is known — a browse-mode call with no user context
    // can't evaluate this, so it's shown rather than hidden.
    if (coupon.firstOrderOnly && context.userId) {
        const hasOrdered = await Order.exists({ user: context.userId });
        if (hasOrdered) return { eligible: false, reason: "This coupon is only valid on your first order" };
    }

    // Daily recurring time window ("happy hour" promos) — independent of
    // expiresAt (which is a one-time end date, not a recurring window).
    if (coupon.activeHours?.start && coupon.activeHours?.end) {
        if (!isWithinTimeWindow(coupon.activeHours.start, coupon.activeHours.end, nowHHMM_IST())) {
            return { eligible: false, reason: `This coupon is only valid between ${coupon.activeHours.start} and ${coupon.activeHours.end}` };
        }
    }

    // Lightweight "customer segment" targeting — computed live from Order
    // history, not a stored/maintained segment field. Only enforced when
    // userId is known (same "show, don't hide, in browse mode" rule as
    // firstOrderOnly above).
    if (context.userId && (coupon.minCustomerOrders > 0 || coupon.minCustomerSpend > 0)) {
        if (coupon.minCustomerOrders > 0) {
            const orderCount = await Order.countDocuments({ user: context.userId, orderStatus: { $ne: "CANCELLED" } });
            if (orderCount < coupon.minCustomerOrders) {
                return { eligible: false, reason: `This coupon is only for customers with ${coupon.minCustomerOrders}+ past orders` };
            }
        }
        if (coupon.minCustomerSpend > 0) {
            const spendAgg = await Order.aggregate([
                { $match: { user: new mongoose.Types.ObjectId(String(context.userId)), orderStatus: { $ne: "CANCELLED" } } },
                { $group: { _id: null, total: { $sum: "$totalAmount" } } },
            ]);
            const totalSpend = spendAgg[0]?.total || 0;
            if (totalSpend < coupon.minCustomerSpend) {
                return { eligible: false, reason: `This coupon is only for customers who've spent ₹${coupon.minCustomerSpend.toLocaleString("en-IN")}+` };
            }
        }
    }

    // Only enforced when itemsTotal is actually known — a "browse all my
    // available coupons" call (no cart context yet) must not hide every
    // minOrderValue coupon just because an absent itemsTotal defaults to 0.
    if (context.itemsTotal !== undefined) {
        const itemsTotal = Number(context.itemsTotal) || 0;
        if (itemsTotal < (coupon.minOrderValue || 0)) {
            const more = (coupon.minOrderValue - itemsTotal);
            return { eligible: false, reason: `Add ₹${more.toLocaleString("en-IN")} more to use this coupon` };
        }
    }

    // Module scope — an ORDER coupon can never apply to a subscription
    // purchase and vice versa.
    const module = context.module || "ORDER";
    if ((coupon.couponModule || "ORDER") !== module) {
        return { eligible: false, reason: "This coupon isn't valid for this purchase type" };
    }

    if (module === "VENDOR_SUBSCRIPTION") {
        if (coupon.applicableSubscriptionPlans?.length && context.subscriptionPlan) {
            if (!coupon.applicableSubscriptionPlans.includes(context.subscriptionPlan)) {
                return { eligible: false, reason: "This coupon doesn't apply to the selected plan" };
            }
        }
        return { eligible: true };
    }

    // module === "ORDER" from here on.
    if (coupon.applicableTo !== "ALL" && context.orderMode) {
        const type = context.orderMode === "urbexon_hour" ? "URBEXON_HOUR" : "ECOMMERCE";
        if (coupon.applicableTo !== type) {
            return { eligible: false, reason: `This coupon only applies to ${coupon.applicableTo === "URBEXON_HOUR" ? "Urbexon Hour" : "regular"} orders` };
        }
    }

    if (context.userId && coupon.excludedUsers?.some((u) => idsMatch(u, context.userId))) {
        return { eligible: false, reason: "This coupon isn't available for your account" };
    }

    if (context.state && coupon.applicableStates?.length && !coupon.applicableStates.some((s) => norm(s) === norm(context.state))) {
        return { eligible: false, reason: "This coupon isn't valid in your state" };
    }
    if (context.pincode && coupon.applicablePincodes?.length && !coupon.applicablePincodes.includes(String(context.pincode).trim())) {
        return { eligible: false, reason: "This coupon isn't valid for your pincode" };
    }

    if (Array.isArray(context.items) && context.items.length) {
        const items = context.items;

        // Exclusions always subtract — if ANY cart item matches an
        // excluded product/category/vendor/brand, the coupon doesn't
        // apply to this cart at all (Phase 1 discounts the whole
        // itemsTotal, there's no per-line-item partial-discount
        // mechanism to only exclude that one item — see plan doc).
        if (coupon.excludedProducts?.length && items.some((i) => coupon.excludedProducts.some((p) => idsMatch(p, i.productId)))) {
            return { eligible: false, reason: "Your cart contains an item this coupon excludes" };
        }
        if (coupon.excludedCategories?.length && items.some((i) => coupon.excludedCategories.some((c) => norm(c) === norm(i.category)))) {
            return { eligible: false, reason: "Your cart contains an item this coupon excludes" };
        }
        if (coupon.excludedVendors?.length && items.some((i) => i.vendorId && coupon.excludedVendors.some((v) => idsMatch(v, i.vendorId)))) {
            return { eligible: false, reason: "Your cart contains an item this coupon excludes" };
        }
        if (coupon.excludedBrands?.length && items.some((i) => coupon.excludedBrands.some((b) => norm(b) === norm(i.brand)))) {
            return { eligible: false, reason: "Your cart contains an item this coupon excludes" };
        }

        // Targeting — at least one cart item must match, when a dimension
        // is restricted.
        if (coupon.applicableCategories?.length && !items.some((i) => coupon.applicableCategories.some((c) => norm(c) === norm(i.category)))) {
            return { eligible: false, reason: "This coupon doesn't apply to any item in your cart" };
        }
        if (coupon.applicableBrands?.length && !items.some((i) => coupon.applicableBrands.some((b) => norm(b) === norm(i.brand)))) {
            return { eligible: false, reason: "This coupon doesn't apply to any item in your cart" };
        }
        if (coupon.applicableProducts?.length && !items.some((i) => coupon.applicableProducts.some((p) => idsMatch(p, i.productId)))) {
            return { eligible: false, reason: "This coupon doesn't apply to any item in your cart" };
        }
        if (coupon.applicableVendors?.length && !items.some((i) => i.vendorId && coupon.applicableVendors.some((v) => idsMatch(v, i.vendorId)))) {
            return { eligible: false, reason: "This coupon doesn't apply to any item in your cart" };
        }
        if (coupon.applicableCollections?.length) {
            const matches = await productsMatchAnyCollection(items.map((i) => i.productId), coupon.applicableCollections);
            if (!matches) return { eligible: false, reason: "This coupon doesn't apply to any item in your cart" };
        }

        // Total quantity across whichever items count toward this coupon
        // (the targeted subset if any targeting is set, else the whole
        // cart) — separate dimension from minOrderValue (₹).
        if (coupon.minItemQuantity > 0) {
            const matchingItems = getMatchingItems(coupon, items);
            const qty = matchingItems.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
            if (qty < coupon.minItemQuantity) {
                return { eligible: false, reason: `Add ${coupon.minItemQuantity - qty} more item(s) to use this coupon` };
            }
        }

        // Subtotal of just the applicableCategories items (not the whole
        // cart) must reach this amount — a refinement of minOrderValue for
        // category-targeted coupons. Only meaningful when categories are
        // actually targeted; silently skipped otherwise.
        if (coupon.categoryMinSpend > 0 && coupon.applicableCategories?.length) {
            const categorySpend = items
                .filter((i) => coupon.applicableCategories.some((c) => norm(c) === norm(i.category)))
                .reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
            if (categorySpend < coupon.categoryMinSpend) {
                const more = coupon.categoryMinSpend - categorySpend;
                return { eligible: false, reason: `Add ₹${more.toLocaleString("en-IN")} more from ${coupon.applicableCategories.join("/")} to use this coupon` };
            }
        }
    }

    return { eligible: true };
};

/* Items that count toward this coupon's targeting — the subset matching
   applicableCategories/Brands/Products/Vendors if any are set, else every
   cart item (an untargeted coupon applies to the whole cart). Shared by
   minItemQuantity so "how many qualifying items" means the same thing
   eligibility already decided it means. */
const getMatchingItems = (coupon, items) => {
    const hasTargeting =
        coupon.applicableCategories?.length || coupon.applicableBrands?.length ||
        coupon.applicableProducts?.length || coupon.applicableVendors?.length;
    if (!hasTargeting) return items;
    return items.filter((i) =>
        coupon.applicableCategories?.some((c) => norm(c) === norm(i.category)) ||
        coupon.applicableBrands?.some((b) => norm(b) === norm(i.brand)) ||
        coupon.applicableProducts?.some((p) => idsMatch(p, i.productId)) ||
        (i.vendorId && coupon.applicableVendors?.some((v) => idsMatch(v, i.vendorId)))
    );
};

/* Checks whether any of the given product ids satisfies any of the given
   Collections' rules — reuses the existing rule-to-Mongo-filter helper
   (collectionService.js::buildCollectionFilter) instead of duplicating it. */
const productsMatchAnyCollection = async (productIds, collectionIds) => {
    const collections = await Collection.find({ _id: { $in: collectionIds } }).select("rules").lean();
    for (const c of collections) {
        const filter = buildCollectionFilter(c.rules);
        const exists = await Product.exists({ _id: { $in: productIds }, ...filter });
        if (exists) return true;
    }
    return false;
};

/* ── Ranked eligibility for a context — used by /coupons/eligible and
   /coupons/active. Returns every candidate (eligible or not) with a
   discountPreview computed regardless, so a UI can show near-misses
   ("Add ₹120 more to unlock SAVE10") next to genuinely-usable codes. ── */
export const getEligibleCoupons = async (context = {}) => {
    const coupons = await getActiveCoupons();
    const results = [];
    for (const coupon of coupons) {
        const { eligible, reason } = await isCouponEligible(coupon, context);
        results.push({
            coupon,
            eligible,
            reason: reason || null,
            discountPreview: calcDiscount(coupon, Number(context.itemsTotal) || 0),
        });
    }
    // Eligible first, then by priority desc, then by discount desc.
    results.sort((a, b) => {
        if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
        if ((b.coupon.priority || 0) !== (a.coupon.priority || 0)) return (b.coupon.priority || 0) - (a.coupon.priority || 0);
        return b.discountPreview - a.discountPreview;
    });
    return results;
};

/* ── Priority/exclusivity resolution for auto-apply — among ELIGIBLE,
   autoApply-enabled candidates, exclusive coupons always beat non-exclusive
   ones regardless of priority number; ties broken by priority, then by
   discount amount, then by age (oldest first, i.e. most established offer
   wins a tie). ── */
export const resolveBestCoupon = (eligibleList) => {
    const candidates = eligibleList.filter((r) => r.eligible && r.coupon.autoApply);
    if (!candidates.length) return null;
    candidates.sort((a, b) => {
        const aEx = a.coupon.isExclusive ? 1 : 0, bEx = b.coupon.isExclusive ? 1 : 0;
        if (aEx !== bEx) return bEx - aEx;
        if ((b.coupon.priority || 0) !== (a.coupon.priority || 0)) return (b.coupon.priority || 0) - (a.coupon.priority || 0);
        if (b.discountPreview !== a.discountPreview) return b.discountPreview - a.discountPreview;
        return new Date(a.coupon.createdAt) - new Date(b.coupon.createdAt);
    });
    return candidates[0].coupon;
};

/* ── THE canonical validate-one-coupon function — used identically by the
   /coupons/validate preview endpoint AND the authoritative
   calculateOrderPricing() path. Not two call sites with separate logic. ── */
export const validateCouponForContext = async ({ code, couponId, context = {} }) => {
    if (!couponId && !code) return { valid: false, coupon: null, discount: 0, reason: "No coupon specified" };

    const query = couponId ? { _id: couponId } : { code: String(code).toUpperCase().trim() };
    const coupon = await Coupon.findOne(query).lean();
    if (!coupon) return { valid: false, coupon: null, discount: 0, reason: "Invalid coupon code" };

    const { eligible, reason } = await isCouponEligible(coupon, context);
    if (!eligible) return { valid: false, coupon, discount: 0, reason };

    const discount = calcDiscount(coupon, Number(context.itemsTotal) || 0);
    return { valid: true, coupon, discount, reason: null };
};

/* ── Atomic usage marking — race-condition-safe under concurrent requests.
   See the Phase 1 plan doc for the full CAS design rationale; summary:
   global + per-user caps are enforced via a single $expr-guarded
   findOneAndUpdate (extending the exact pattern the old markCouponUsed
   already used). The daily cap can't be atomically conditioned within that
   same operation across a date rollover, so it gets a bounded (max 2
   attempts) CAS-retry: same-day incr → (on stale date) day-init → retry
   same-day incr once against the now-fresh row. No multi-document
   transaction needed. ── */
export const markCouponUsage = async ({
    couponId, userId, orderId = null, subscriptionId = null, vendorId = null,
    module = "ORDER", discountAmount = 0, discountType, orderTotal = 0, ip = "", userAgent = "",
}) => {
    if (!couponId || !userId) return false;

    const coupon = await Coupon.findById(couponId).select("code usageLimit userUsageLimit dailyRedemptionLimit").lean();
    if (!coupon) return false;

    const uid = new mongoose.Types.ObjectId(String(userId));
    const usageExprs = [
        { $or: [{ $eq: ["$usageLimit", null] }, { $lt: ["$usedCount", "$usageLimit"] }] },
    ];
    if (coupon.userUsageLimit !== null && coupon.userUsageLimit !== undefined) {
        usageExprs.push({
            $lt: [
                { $size: { $filter: { input: { $ifNull: ["$usedBy", []] }, as: "u", cond: { $eq: ["$$u.userId", uid] } } } },
                coupon.userUsageLimit,
            ],
        });
    }
    const pushEntry = (coupon.userUsageLimit === null || coupon.userUsageLimit === undefined)
        ? {}
        : { $push: { usedBy: { userId: uid, at: new Date() } } };

    let result = null;

    if (coupon.dailyRedemptionLimit == null) {
        result = await Coupon.findOneAndUpdate(
            { _id: couponId, $expr: { $and: usageExprs } },
            { $inc: { usedCount: 1 }, ...pushEntry },
            { new: true }
        );
    } else {
        const today = todayIST();
        result = await Coupon.findOneAndUpdate(
            {
                _id: couponId,
                "dailyUsage.date": today,
                $expr: { $and: [...usageExprs, { $lt: ["$dailyUsage.count", coupon.dailyRedemptionLimit] }] },
            },
            { $inc: { usedCount: 1, "dailyUsage.count": 1 }, ...pushEntry },
            { new: true }
        );
        if (!result) {
            const fresh = await Coupon.findById(couponId).select("dailyUsage").lean();
            if (fresh && fresh.dailyUsage?.date !== today) {
                result = await Coupon.findOneAndUpdate(
                    { _id: couponId, "dailyUsage.date": { $ne: today }, $expr: { $and: usageExprs } },
                    { $set: { "dailyUsage.date": today, "dailyUsage.count": 1 }, $inc: { usedCount: 1 }, ...pushEntry },
                    { new: true }
                );
                if (!result) {
                    // Lost the day-init race to a concurrent request — the
                    // row is now freshly initialized, retry the same-day
                    // increment once more.
                    result = await Coupon.findOneAndUpdate(
                        {
                            _id: couponId,
                            "dailyUsage.date": today,
                            $expr: { $and: [...usageExprs, { $lt: ["$dailyUsage.count", coupon.dailyRedemptionLimit] }] },
                        },
                        { $inc: { usedCount: 1, "dailyUsage.count": 1 }, ...pushEntry },
                        { new: true }
                    );
                }
            }
        }
    }

    if (!result) {
        console.warn(`[couponEngine] Could not mark coupon ${couponId} as used for user ${userId} (limit reached or not found)`);
        return false;
    }

    // Ledger write — never allowed to fail the caller; the order/subscription
    // already succeeded by the time this runs. Same defensive .catch style
    // already used at every existing markCouponUsed call site.
    CouponUsage.create({
        couponId, code: result.code, userId, vendorId, orderId, subscriptionId,
        module, discountType, discountAmount, orderTotal, ip, userAgent,
    }).catch((err) => console.warn("[couponEngine] CouponUsage ledger write failed:", err.message));

    return true;
};

/* ── Rollback on order cancellation / subscription payment failure. ── */
export const unmarkCouponUsage = async ({ couponId, couponCode, userId, orderId = null }) => {
    if (!userId || (!couponId && !couponCode)) return;
    const filter = couponId ? { _id: couponId } : { code: String(couponCode).toUpperCase() };
    const coupon = await Coupon.findOne(filter).select("_id userUsageLimit").lean();
    if (!coupon) return;

    const update = { $inc: { usedCount: -1 } };

    // Undo the daily counter too, but only if unwinding on the same IST
    // day it was consumed — a cancellation days later shouldn't corrupt a
    // different day's counter.
    const today = todayIST();
    await Coupon.updateOne(
        { _id: coupon._id, "dailyUsage.date": today, "dailyUsage.count": { $gt: 0 } },
        { $inc: { "dailyUsage.count": -1 } }
    ).catch(() => { });

    if (coupon.userUsageLimit !== null && coupon.userUsageLimit !== undefined) {
        // Remove exactly ONE matching usedBy entry — not all of them. A
        // user with userUsageLimit > 1 may have several legitimate entries
        // from separate orders; over-removing would let them over-redeem.
        const withEntry = await Coupon.findOne(
            { _id: coupon._id, "usedBy.userId": userId },
            { "usedBy.$": 1 }
        ).lean();
        const entryId = withEntry?.usedBy?.[0]?._id;
        if (entryId) update.$pull = { usedBy: { _id: entryId } };
    }

    const result = await Coupon.findOneAndUpdate(filter, update);
    if (!result) console.warn(`[couponEngine] Could not unmark coupon ${couponId || couponCode} for user ${userId} (not found or already unmarked)`);

    const usageFilter = orderId
        ? { orderId, status: "APPLIED" }
        : { couponId: coupon._id, userId, status: "APPLIED" };
    await CouponUsage.findOneAndUpdate(usageFilter, { $set: { status: "REVERSED", reversedAt: new Date() } }).catch(() => { });
};
