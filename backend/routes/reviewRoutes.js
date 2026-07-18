import express from "express";
import { protect, adminOnly } from "../middlewares/authMiddleware.js";
import {
    addReview,
    getProductReviews,
    deleteReview,
    getMyReviews,
    adminGetAllReviews,
    adminDeleteReview,
} from "../controllers/Reviewcontroller.js";

const router = express.Router();

// ── ADMIN moderation — specific paths BEFORE the /:productId catch-alls ──
router.get("/admin/all", protect, adminOnly, adminGetAllReviews);
router.delete("/admin/:reviewId", protect, adminOnly, adminDeleteReview);

// GET /api/reviews/my (user's reviews) — MUST be before /:productId
router.get("/my", protect, getMyReviews);

// ✅ POST /api/reviews/:productId (matches frontend)
router.post("/:productId", protect, addReview);

// ✅ GET /api/reviews/:productId (matches frontend)
router.get("/:productId", getProductReviews);

// DELETE /api/reviews/:reviewId
router.delete("/:reviewId", protect, deleteReview);

export default router;
