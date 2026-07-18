/**
 * SearchLog.js — lightweight search analytics.
 * One doc per normalized term; count/lastSearchedAt upserted on each
 * search. Powers "Trending Searches" and gives admin visibility into
 * what users look for (and what returns zero results).
 */
import mongoose from "mongoose";

const searchLogSchema = new mongoose.Schema(
    {
        term: { type: String, required: true, trim: true, lowercase: true, maxlength: 60, unique: true },
        count: { type: Number, default: 1 },
        lastResultCount: { type: Number, default: 0 },
        lastSearchedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

searchLogSchema.index({ count: -1, lastSearchedAt: -1 });

export default mongoose.model("SearchLog", searchLogSchema);
