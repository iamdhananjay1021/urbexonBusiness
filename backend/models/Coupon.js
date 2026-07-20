/**
 * Coupon.js — Coupon / Promo code model
 *
 * Phase 1 enterprise rebuild. Every field below that existed before keeps
 * its exact name/semantics — this is additive, not a rewrite, so every
 * coupon created under the old schema keeps working unmodified (see the
 * one-time backfill script backend/scripts/backfillCouponDefaults.js for
 * why that's true even for documents saved before this file changed).
 *
 * All validation/eligibility/discount logic lives in
 * backend/services/couponEngine.js — this file only defines shape.
 */
import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: [true, "Code is required"],
        unique: true,
        uppercase: true,
        trim: true,
        maxlength: 30,
        index: true,
    },
    description: { type: String, trim: true, default: "" },
    discountType: {
        type: String,
        // FREE_SHIPPING added — cheap and real (pricing.js already computes
        // deliveryCharge server-side, this just zeroes it). WALLET_CASHBACK/
        // REFERRAL/BOGO deliberately NOT added: no wallet, no referral
        // system, and no per-line-item discount mechanism exist anywhere in
        // this codebase — shipping those as dropdown options here would
        // mislead admins into thinking they work. Add them later, for real,
        // once the infrastructure they need actually exists.
        enum: ["PERCENT", "FLAT", "FREE_SHIPPING"],
        default: "PERCENT",
    },
    // Required for PERCENT/FLAT, meaningless for FREE_SHIPPING — enforced
    // in couponEngine.js rather than a schema-level conditional validator,
    // consistent with how discountType===PERCENT>100 is already double
    // -checked in the controller today rather than only in the schema.
    discountValue: { type: Number, default: 0, min: 0, max: [100000, "Discount value too high"] },
    maxDiscount: { type: Number, default: null },     // cap for PERCENT type
    minOrderValue: { type: Number, default: 0 },

    // ── Usage limits ──────────────────────────────────────────
    // usageLimit (existing, unchanged) = GLOBAL redemption cap, null=unlimited.
    // This already *is* what an "enterprise" globalRedemptionLimit field
    // would mean — kept as-is rather than adding a second field with the
    // same meaning under a different name.
    usageLimit: { type: Number, default: null },
    usedCount: { type: Number, default: 0 },
    // Per-user cap. Defaults to 1 for every coupon (including pre-existing
    // ones via backfill) because that's exactly what `usedBy` already
    // enforced unconditionally before this field existed — day-one behavior
    // for every old coupon is unchanged. null = unlimited per user (opt-in;
    // see usedBy's doc-comment below for the bloat trade-off this implies).
    userUsageLimit: { type: Number, default: 1 },
    // New, fully opt-in dimension. null = no daily cap.
    dailyRedemptionLimit: { type: Number, default: null },
    // Paired with dailyRedemptionLimit — see couponEngine.js::markCouponUsage
    // for the atomic day-rollover CAS this backs. date is "YYYY-MM-DD" (IST).
    dailyUsage: {
        date: { type: String, default: "" },
        count: { type: Number, default: 0 },
    },

    // usedBy stays as the atomic fast-path gate markCouponUsage's single
    // -document CAS relies on for "has this user already used this coupon"
    // — a cross-collection ledger (CouponUsage) check can't be expressed
    // atomically in one Mongo operation without a multi-document
    // transaction, which isn't justified for this check. BLOAT GUARD: the
    // engine only pushes here when userUsageLimit is a finite number (the
    // default/common case) — a coupon explicitly set to unlimited-per-user
    // skips this array entirely and relies on usageLimit/dailyRedemptionLimit
    // + the CouponUsage ledger, so a high-volume unlimited coupon can never
    // grow this subdocument array toward the 16MB BSON document limit.
    usedBy: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        at: { type: Date, default: Date.now },
    }],

    // NEW — default false reproduces today's behavior for every existing
    // coupon (no restriction). When true, only applies to a user who has
    // never placed an order before (regardless of that order's status —
    // see couponEngine.js::isCouponEligible for the exact check and why
    // status is deliberately not filtered).
    firstOrderOnly: { type: Boolean, default: false },

    // ── Timing / quantity / spend gates — all default to "no restriction",
    //    zero effect on existing coupons ─────────────────────────────
    // Daily recurring time window ("happy hour" promos), IST, "HH:MM"
    // 24-hour format. Both null = always active (subject to expiresAt as
    // before). Deliberately no overnight-wrap ambiguity in the UI (admin
    // enters e.g. 18:00-20:00); the engine still supports start > end as
    // an overnight window (e.g. 22:00-02:00) if ever needed.
    activeHours: {
        start: { type: String, default: null },
        end: { type: String, default: null },
    },
    // Total cart item quantity (summed across matching items) required —
    // separate from minOrderValue (₹). 0 = no restriction.
    minItemQuantity: { type: Number, default: 0 },
    // Only meaningful alongside applicableCategories — requires the
    // SUBTOTAL of just the matching-category items (not the whole cart)
    // to reach this amount. 0 = no restriction (existing minOrderValue
    // still applies to the whole cart as before).
    categoryMinSpend: { type: Number, default: 0 },
    // Lightweight "customer segment" targeting — computed live from Order
    // history at eligibility time rather than a stored/maintained segment
    // field (no classification subsystem exists or is needed for this).
    // 0 = no restriction on either.
    minCustomerOrders: { type: Number, default: 0 },
    minCustomerSpend: { type: Number, default: 0 },

    // ── Module scope ──────────────────────────────────────────
    // Existing field, meaning unchanged: which ORDER channel this applies
    // to. Orthogonal to couponModule below, not superseded by it — see
    // couponModule's doc-comment for why these are two separate axes.
    applicableTo: {
        type: String,
        enum: ["ALL", "ECOMMERCE", "URBEXON_HOUR"],
        default: "ALL",
    },
    // NEW. "ORDER" (default, matches every pre-existing coupon's actual
    // real-world use exactly) vs "VENDOR_SUBSCRIPTION". applicableTo's
    // ECOMMERCE/URBEXON_HOUR values are meaningless for a subscription
    // purchase (it isn't an order channel), so rather than overload an
    // enum admins already understand as "order channel" with subscription
    // semantics, this is a separate, orthogonal dimension. When "ORDER",
    // applicableTo is checked exactly as before. When
    // "VENDOR_SUBSCRIPTION", applicableTo is ignored and
    // applicableSubscriptionPlans governs targeting instead.
    couponModule: {
        type: String,
        enum: ["ORDER", "VENDOR_SUBSCRIPTION"],
        default: "ORDER",
    },
    // Only meaningful when couponModule === "VENDOR_SUBSCRIPTION".
    // [] = applies to every plan tier.
    applicableSubscriptionPlans: {
        type: [String],
        enum: ["starter", "basic", "standard", "premium"],
        default: [],
    },

    // ── Priority / stacking / auto-apply ───────────────────────
    // All default to reproduce today's exact implicit behavior — nothing
    // outranks/overrides/auto-fills anything until an admin opts a coupon
    // into it, so no pre-existing coupon's real-world behavior changes on
    // deploy. See couponEngine.js::resolveBestCoupon for the exact
    // resolution algorithm these drive.
    priority: { type: Number, default: 0, index: true },
    isStackable: { type: Boolean, default: false },
    isExclusive: { type: Boolean, default: false },
    autoApply: { type: Boolean, default: false },

    // ── Targeting (inclusion) ──────────────────────────────────
    // Convention: empty array = no restriction on that dimension (matches
    // everything) — consistent with applicableTo's existing "ALL" default
    // and with Collection.rules' "every field optional, present rules AND
    // together" convention (backend/models/Collection.js). Category/brand
    // are plain-string matches against Product.category/brand because
    // those fields are themselves plain trimmed Strings with no
    // referential integrity to a Category collection anywhere else in this
    // codebase — matching them as free text keeps this consistent rather
    // than inventing referential integrity that doesn't exist elsewhere.
    applicableCategories: { type: [String], default: [] },
    applicableBrands: { type: [String], default: [] },
    applicableProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    applicableVendors: [{ type: mongoose.Schema.Types.ObjectId, ref: "Vendor" }],
    // Matched via the existing buildCollectionFilter() helper
    // (backend/services/collectionService.js) — not a duplicated
    // rule-to-Mongo-filter implementation.
    applicableCollections: [{ type: mongoose.Schema.Types.ObjectId, ref: "Collection" }],

    // ── Exclusions — always subtract, regardless of applicable* matches ──
    excludedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    excludedCategories: { type: [String], default: [] },
    excludedVendors: [{ type: mongoose.Schema.Types.ObjectId, ref: "Vendor" }],
    excludedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    excludedBrands: { type: [String], default: [] },

    // ── Geo restriction — India-only platform, pincode-serviceability
    //    based (matches how serviceability is checked everywhere else in
    //    this codebase) — no "country" field, it would be dead weight. ──
    applicableStates: { type: [String], default: [] },
    applicablePincodes: { type: [String], default: [] },

    isActive: { type: Boolean, default: true, index: true },
    expiresAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

couponSchema.index({ code: 1, isActive: 1 });
// Auto-apply candidate lookup — the engine fetches "active, not expired,
// auto-apply eligible" coupons as its first filter on every checkout.
couponSchema.index({ isActive: 1, autoApply: 1, expiresAt: 1 });

export default mongoose.model("Coupon", couponSchema);
