/**
 * vendorReviewController.js — Vendor Reviews & Replies.
 *
 * Ownership scoping uses the exact same pattern as vendorOrders.js/
 * vendorEarnings.js: derive the vendor's product-id list, then scope the
 * Review query to it — not a denormalized Review.vendorId field. This
 * needed zero backfill for existing reviews and reuses the codebase's
 * one established convention for "vendor-scoped access to a
 * product-linked collection" rather than inventing a second one.
 */
import Review from "../../models/Review.js";
import Product from "../../models/Product.js";

const REPLY_MAX_LENGTH = 1000;

const getVendorProductIds = (vendorId) => Product.find({ vendorId }).distinct("_id");

// GET /api/vendor/reviews — paginated, filterable, ownership-scoped
export const getMyVendorReviews = async (req, res) => {
    try {
        const { rating, hasReply, search, page = 1, limit = 20 } = req.query;
        const productIds = await getVendorProductIds(req.vendor._id);
        if (!productIds.length) {
            return res.json({ success: true, reviews: [], total: 0, page: 1, totalPages: 0 });
        }

        const filter = { product: { $in: productIds } };
        if (rating && ["1", "2", "3", "4", "5"].includes(rating)) filter.rating = Number(rating);
        if (hasReply === "true") filter["vendorReply.message"] = { $ne: null };
        if (hasReply === "false") filter["vendorReply.message"] = null;
        if (search?.trim()) {
            const esc = search.trim().slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            filter.$or = [{ name: { $regex: esc, $options: "i" } }, { comment: { $regex: esc, $options: "i" } }];
        }

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(50, parseInt(limit) || 20);

        const [reviews, total] = await Promise.all([
            Review.find(filter)
                .populate("product", "name images slug")
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .lean(),
            Review.countDocuments(filter),
        ]);

        res.json({ success: true, reviews, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
    } catch (err) {
        console.error("[getMyVendorReviews]", err);
        res.status(500).json({ success: false, message: "Failed to fetch reviews" });
    }
};

// GET /api/vendor/reviews/stats — rating summary + distribution + reply rate
export const getVendorReviewStats = async (req, res) => {
    try {
        const productIds = await getVendorProductIds(req.vendor._id);
        if (!productIds.length) {
            return res.json({ success: true, total: 0, avgRating: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, replied: 0, replyRate: 0 });
        }

        const [agg] = await Review.aggregate([
            { $match: { product: { $in: productIds } } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    avgRating: { $avg: "$rating" },
                    replied: { $sum: { $cond: [{ $ne: ["$vendorReply.message", null] }, 1, 0] } },
                    r1: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } },
                    r2: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
                    r3: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
                    r4: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
                    r5: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
                },
            },
        ]);

        if (!agg) {
            return res.json({ success: true, total: 0, avgRating: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, replied: 0, replyRate: 0 });
        }

        res.json({
            success: true,
            total: agg.total,
            avgRating: Math.round(agg.avgRating * 10) / 10,
            distribution: { 1: agg.r1, 2: agg.r2, 3: agg.r3, 4: agg.r4, 5: agg.r5 },
            replied: agg.replied,
            replyRate: agg.total ? Math.round((agg.replied / agg.total) * 100) : 0,
        });
    } catch (err) {
        console.error("[getVendorReviewStats]", err);
        res.status(500).json({ success: false, message: "Failed to fetch review stats" });
    }
};

// Shared ownership-checked fetch — review's product must be in this vendor's catalog
const findOwnedReview = async (vendorId, reviewId) => {
    const productIds = await getVendorProductIds(vendorId);
    return Review.findOne({ _id: reviewId, product: { $in: productIds } });
};

// POST /api/vendor/reviews/:id/reply
export const replyToReview = async (req, res) => {
    try {
        const { message } = req.body;
        if (!message?.trim()) return res.status(400).json({ success: false, message: "Reply message is required" });
        if (message.trim().length > REPLY_MAX_LENGTH) return res.status(400).json({ success: false, message: `Reply must be under ${REPLY_MAX_LENGTH} characters` });

        const review = await findOwnedReview(req.vendor._id, req.params.id);
        if (!review) return res.status(404).json({ success: false, message: "Review not found" });
        if (review.vendorReply?.message) {
            return res.status(400).json({ success: false, message: "Already replied — use edit instead" });
        }

        review.vendorReply = { message: message.trim(), repliedAt: new Date(), repliedBy: req.user._id };
        await review.save();

        res.json({ success: true, review });
    } catch (err) {
        console.error("[replyToReview]", err);
        res.status(500).json({ success: false, message: "Failed to reply" });
    }
};

// PUT /api/vendor/reviews/:id/reply
export const updateReviewReply = async (req, res) => {
    try {
        const { message } = req.body;
        if (!message?.trim()) return res.status(400).json({ success: false, message: "Reply message is required" });
        if (message.trim().length > REPLY_MAX_LENGTH) return res.status(400).json({ success: false, message: `Reply must be under ${REPLY_MAX_LENGTH} characters` });

        const review = await findOwnedReview(req.vendor._id, req.params.id);
        if (!review) return res.status(404).json({ success: false, message: "Review not found" });
        if (!review.vendorReply?.message) return res.status(400).json({ success: false, message: "No existing reply to edit" });

        review.vendorReply.message = message.trim();
        review.vendorReply.repliedAt = new Date();
        await review.save();

        res.json({ success: true, review });
    } catch (err) {
        console.error("[updateReviewReply]", err);
        res.status(500).json({ success: false, message: "Failed to update reply" });
    }
};

// DELETE /api/vendor/reviews/:id/reply
export const deleteReviewReply = async (req, res) => {
    try {
        const review = await findOwnedReview(req.vendor._id, req.params.id);
        if (!review) return res.status(404).json({ success: false, message: "Review not found" });

        review.vendorReply = { message: null, repliedAt: null, repliedBy: null };
        await review.save();

        res.json({ success: true, message: "Reply removed" });
    } catch (err) {
        console.error("[deleteReviewReply]", err);
        res.status(500).json({ success: false, message: "Failed to delete reply" });
    }
};
