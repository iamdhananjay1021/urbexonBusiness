/**
 * PriceHistory.js — Track product price changes for price drop alerts
 */
import mongoose from "mongoose";

const priceHistorySchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
        index: true,
    },
    oldPrice: { type: Number, required: true },
    newPrice: { type: Number, required: true },
    changePercent: { type: Number, default: 0 },
    changedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
}, { timestamps: true });

priceHistorySchema.index({ productId: 1, createdAt: -1 });
// Auto-delete after 90 days
priceHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.model("PriceHistory", priceHistorySchema);
