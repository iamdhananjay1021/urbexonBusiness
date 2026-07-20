/**
 * SearchLog.js — lightweight search analytics.
 * One doc per normalized (term, source) pair; count/lastSearchedAt
 * upserted on each search. Powers "Trending Searches" and gives admin
 * visibility into what users look for (and what returns zero results).
 *
 * BUG FIX: `source` used to not exist — every search (ecommerce or
 * Urbexon Hour) collapsed into one shared `term` bucket. Beyond losing
 * which storefront the demand was actually for, this is also why Urbexon
 * Hour searches never visibly changed analytics: UrbexonHour.jsx never
 * called a backend search endpoint at all (pure client-side filtering of
 * an already-loaded batch — see UrbexonHour.jsx), so logSearchTerm was
 * never reached for UH. Now that it is (getUrbexonHourProducts), source
 * keeps the two demand signals from being merged into one undifferentiated
 * bucket an admin can't act on.
 */
import mongoose from "mongoose";

const searchLogSchema = new mongoose.Schema(
    {
        term: { type: String, required: true, trim: true, lowercase: true, maxlength: 60 },
        source: { type: String, enum: ["ecommerce", "urbexon_hour"], default: "ecommerce", index: true },
        count: { type: Number, default: 1 },
        lastResultCount: { type: Number, default: 0 },
        lastSearchedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

searchLogSchema.index({ term: 1, source: 1 }, { unique: true });
searchLogSchema.index({ count: -1, lastSearchedAt: -1 });

export default mongoose.model("SearchLog", searchLogSchema);
