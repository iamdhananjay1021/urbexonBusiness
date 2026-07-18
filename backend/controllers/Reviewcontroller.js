import Review from "../models/Review.js";
import Product from "../models/Product.js";

const recalcProductRating = async (productId) => {
    try {
        const stats = await Review.aggregate([
            { $match: { product: productId } },
            { $group: { _id: "$product", avgRating: { $avg: "$rating" }, count: { $sum: 1 } } },
        ]);

        if (stats.length > 0) {
            await Product.findByIdAndUpdate(productId, {
                rating: Math.round(stats[0].avgRating * 10) / 10,
                numReviews: stats[0].count,
            });
        } else {
            await Product.findByIdAndUpdate(productId, { rating: 0, numReviews: 0 });
        }
    } catch (err) {
        console.error("[recalcProductRating]", err);
    }
};

export const addReview = async (req, res) => {
    try {
        const { rating, comment } = req.body;
        const productId = req.params.productId;

        if (!rating || Number(rating) < 1 || Number(rating) > 5) {
            return res.status(400).json({ message: "Rating must be between 1 and 5" });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        const review = await Review.findOneAndUpdate(
            { product: productId, user: req.user._id },
            {
                product: productId,
                user: req.user._id,
                name: req.user.name,
                rating: Number(rating),
                comment: comment?.trim() || "",
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        await recalcProductRating(product._id);

        res.status(201).json(review);
    } catch (error) {
        console.error("[addReview]", error);
        res.status(500).json({ message: "Failed to submit review" });
    }
};

export const getProductReviews = async (req, res) => {
    try {
        const reviews = await Review.find({ product: req.params.productId })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        res.json(reviews);
    } catch (error) {
        console.error("[getProductReviews]", error);
        res.status(500).json({ message: "Failed to fetch reviews" });
    }
};

export const deleteReview = async (req, res) => {
    try {
        const review = await Review.findById(req.params.reviewId);
        if (!review) return res.status(404).json({ message: "Review not found" });
        if (review.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const productId = review.product;
        await review.deleteOne();
        await recalcProductRating(productId);

        res.json({ message: "Review deleted" });
    } catch (error) {
        console.error("[deleteReview]", error);
        res.status(500).json({ message: "Failed to delete review" });
    }
};

/* ── ADMIN: moderation — list all reviews (filter by rating/search) ── */
export const adminGetAllReviews = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));
        const filter = {};
        const rating = Number(req.query.rating);
        if (rating >= 1 && rating <= 5) filter.rating = rating;
        const q = (req.query.search || "").trim().slice(0, 50);
        if (q) {
            const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
            filter.$or = [{ name: rx }, { comment: rx }];
        }

        const [reviews, total] = await Promise.all([
            Review.find(filter)
                .populate("product", "name slug images")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit).limit(limit).lean(),
            Review.countDocuments(filter),
        ]);

        res.json({ success: true, reviews, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) {
        console.error("[adminGetAllReviews]", error);
        res.status(500).json({ success: false, message: "Failed to fetch reviews" });
    }
};

/* ── ADMIN: moderation — delete any review (abusive/fake content).
      Same rating-recalc path as the user's own delete. ── */
export const adminDeleteReview = async (req, res) => {
    try {
        const review = await Review.findById(req.params.reviewId);
        if (!review) return res.status(404).json({ success: false, message: "Review not found" });
        const productId = review.product;
        await review.deleteOne();
        await recalcProductRating(productId);
        res.json({ success: true, message: "Review removed" });
    } catch (error) {
        console.error("[adminDeleteReview]", error);
        res.status(500).json({ success: false, message: "Failed to delete review" });
    }
};

export const getMyReviews = async (req, res) => {
    try {
        const reviews = await Review.find({ user: req.user._id })
            .populate("product", "name images slug")
            .sort({ createdAt: -1 })
            .lean();
        res.json(reviews);
    } catch (err) {
        console.error("[getMyReviews]", err);
        res.status(500).json({ message: "Failed to fetch reviews" });
    }
};