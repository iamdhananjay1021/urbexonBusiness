import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
    addReview,
    getProductReviews,
    deleteReview,
    getMyReviews,
} from "../controllers/Reviewcontroller.js";

const router = express.Router();

// GET /api/reviews/my (user's reviews) — MUST be before /:productId
router.get("/my", protect, getMyReviews);

// ✅ POST /api/reviews/:productId (matches frontend)
router.post("/:productId", protect, addReview);

// ✅ GET /api/reviews/:productId (matches frontend)
router.get("/:productId", getProductReviews);

// DELETE /api/reviews/:reviewId
router.delete("/:reviewId", protect, deleteReview);

export default router;