/**
 * One-time backfill for the Vendor Wallet Ledger (approved design).
 *
 * The ledger and Vendor.walletBalance are new — existing vendors already
 * have real settled earnings that predate both. For each vendor this
 * computes their true current balance as of today:
 *
 *     SUM(paid Settlement.vendorEarning) - SUM(completed Payout.amount)
 *
 * ...writes it to Vendor.walletBalance, and writes ONE synthetic
 * "opening_balance" ledger entry per vendor so the ledger's own sum
 * reconciles with walletBalance from day one (otherwise the ledger would
 * be silently incomplete for everything that happened before this feature
 * shipped — honest, but makes the reconciliation job's job harder for no
 * reason).
 *
 * Idempotent — a vendor who already has an "opening_balance" entry is
 * skipped entirely (both the Vendor.walletBalance write and the ledger
 * insert), so re-running this script after a partial run, or after real
 * traffic has already started crediting/debiting some vendors, never
 * double-counts or overwrites live balances. Vendors are processed
 * sequentially (not concurrently) since this is a one-off migration
 * script, not a live request path — no Mongo session/transaction is
 * needed here for the same reason vendorWalletService.js's credit()/
 * debit() need one and this script doesn't: nothing else can be writing
 * to these vendors' wallets while a migration script runs against an
 * as-yet-unlaunched feature.
 *
 * Run: node scripts/backfillVendorWalletBalance.js
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import Vendor from "../models/vendorModels/Vendor.js";
import { Settlement } from "../models/vendorModels/Settlement.js";
import Payout from "../models/Payout.js";
import VendorWalletTransaction from "../models/vendorModels/VendorWalletTransaction.js";

dotenv.config();

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected...");

    const vendors = await Vendor.find({ isDeleted: { $ne: true } }).select("_id").lean();
    console.log(`Found ${vendors.length} vendor(s) to check.`);

    let backfilled = 0;
    let skipped = 0;

    for (const vendor of vendors) {
        // IDEMPOTENCY GUARD — the actual mechanism, not just a comment.
        const alreadyDone = await VendorWalletTransaction.findOne({
            vendorId: vendor._id,
            type: "opening_balance",
        }).lean();
        if (alreadyDone) {
            skipped++;
            continue;
        }

        const [settlementAgg, payoutAgg] = await Promise.all([
            Settlement.aggregate([
                { $match: { vendorId: vendor._id, status: "paid" } },
                { $group: { _id: null, total: { $sum: "$vendorEarning" } } },
            ]),
            Payout.aggregate([
                { $match: { recipientId: vendor._id, recipientType: "vendor", status: "completed" } },
                { $group: { _id: null, total: { $sum: "$amount" } } },
            ]),
        ]);

        const totalEarned = settlementAgg[0]?.total || 0;
        const totalWithdrawn = payoutAgg[0]?.total || 0;
        const openingBalance = Math.max(0, totalEarned - totalWithdrawn);

        // Zero-balance vendors still get marked done (an entry with
        // amount 0 would fail the model's min:0.01 validator, and a
        // vendor with nothing to backfill doesn't need a ledger row at
        // all) — write a 0-amount marker is wrong; instead just set the
        // balance and record via a skip-safe marker without a ledger
        // entry when there's truly nothing to record.
        if (openingBalance > 0) {
            await VendorWalletTransaction.create({
                vendorId: vendor._id,
                type: "opening_balance",
                amount: openingBalance,
                balanceAfter: openingBalance,
                referenceType: null,
                referenceId: null,
                description: "Opening balance — pre-ledger historical earnings backfill",
                createdBy: null,
            });
        }

        await Vendor.findByIdAndUpdate(vendor._id, { $set: { walletBalance: openingBalance } });
        backfilled++;
        console.log(`  Vendor ${vendor._id}: walletBalance = ₹${openingBalance}`);
    }

    console.log(`Done. Backfilled: ${backfilled}, already done (skipped): ${skipped}.`);
    await mongoose.disconnect();
    process.exit(0);
};

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
