import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
            index: true,
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        name: {
            type: String,
            required: true,
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        comment: {
            type: String,
            trim: true,
            default: "",
        },

        // Vendor Reviews & Replies — vendor-facing response to a review on
        // their own product. Ownership is derived at query time via
        // Product.vendorId (same pattern as vendorOrders.js), not
        // denormalized here, so this needed no backfill for existing
        // reviews.
        vendorReply: {
            message: { type: String, trim: true, maxlength: 1000, default: null },
            repliedAt: { type: Date, default: null },
            repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        },
    },
    { timestamps: true }
);

// One review per user per product
reviewSchema.index({ product: 1, user: 1 }, { unique: true });
// Vendor review list: product $in [...] sorted recent-first, no in-memory sort
reviewSchema.index({ product: 1, createdAt: -1 });

export default mongoose.model("Review", reviewSchema);