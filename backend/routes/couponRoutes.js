import express from "express";
import { protect, adminOnly } from "../middlewares/authMiddleware.js";
import { validateCoupon, getActiveCoupons, adminGetCoupons, adminCreateCoupon, adminUpdateCoupon, adminDeleteCoupon, adminToggleCoupon } from "../controllers/couponController.js";

const router = express.Router();
router.post("/validate", protect, validateCoupon);
router.get("/active", protect, getActiveCoupons);
router.get   ("/admin",          protect, adminOnly, adminGetCoupons);
router.post  ("/admin",          protect, adminOnly, adminCreateCoupon);
router.put   ("/admin/:id",      protect, adminOnly, adminUpdateCoupon);
router.delete("/admin/:id",      protect, adminOnly, adminDeleteCoupon);
router.patch ("/admin/:id/toggle", protect, adminOnly, adminToggleCoupon);
export default router;
