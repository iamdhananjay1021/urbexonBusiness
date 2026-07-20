/**
 * One-time backfill for the Phase 1 coupon engine schema fields
 * (backend/models/Coupon.js). Mongoose applies schema defaults lazily on
 * read/save, not retroactively to documents already in the DB — this
 * writes the real defaults onto every pre-existing Coupon document so
 * admin list/edit views show explicit values instead of relying on
 * implicit undefined-behaves-like-default everywhere.
 *
 * Idempotent — the `priority: { $exists: false }` guard means re-running
 * this is a safe no-op. It is also safe to deploy the schema/engine change
 * BEFORE running this: couponEngine.js treats `undefined` identically to
 * each field's schema default (falsy/empty checks, never strict
 * `===false`/`===[]`), so there's no broken window either way.
 *
 * Run: node scripts/backfillCouponDefaults.js
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import Coupon from "../models/Coupon.js";

dotenv.config();

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected...");

    const result = await Coupon.updateMany(
        { priority: { $exists: false } },
        {
            $set: {
                priority: 0,
                isStackable: false,
                isExclusive: false,
                autoApply: false,
                userUsageLimit: 1,
                dailyRedemptionLimit: null,
                dailyUsage: { date: "", count: 0 },
                couponModule: "ORDER",
                applicableSubscriptionPlans: [],
                applicableCategories: [],
                applicableBrands: [],
                applicableProducts: [],
                applicableVendors: [],
                applicableCollections: [],
                excludedProducts: [],
                excludedCategories: [],
                excludedVendors: [],
                excludedUsers: [],
                excludedBrands: [],
                applicableStates: [],
                applicablePincodes: [],
            },
        }
    );

    console.log(`Done. Matched: ${result.matchedCount}, modified: ${result.modifiedCount}.`);
    await mongoose.disconnect();
    process.exit(0);
};

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
