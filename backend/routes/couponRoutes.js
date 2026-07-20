import express from "express";
import rateLimit from "express-rate-limit";
import { protect, adminOnly } from "../middlewares/authMiddleware.js";
import {
    validateCoupon, getActiveCoupons, couponEligible,
    adminGetCoupons, adminGetCouponAnalytics, adminCreateCoupon, adminUpdateCoupon, adminDeleteCoupon, adminToggleCoupon,
} from "../controllers/couponController.js";

/* The mount-level generalLimiter (server.js, 120/min/IP) is far too
   permissive for guess-protection on a short alphanumeric code space —
   same construction pattern as productRoutes.js's local writeLimiter.
   Keyed by user id (not raw IP) since every route below already requires
   `protect`, so one account's guess rate is bounded without over-
   throttling many legitimate users behind one NAT. */
const couponValidateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 12,
    keyGenerator: (req) => String(req.user?._id || req.ip),
    message: "Too many coupon attempts — please wait a minute and try again",
});

const router = express.Router();
router.post("/validate", protect, couponValidateLimiter, validateCoupon);
router.post("/eligible", protect, couponValidateLimiter, couponEligible);
router.get("/active", protect, getActiveCoupons);
router.get   ("/admin",          protect, adminOnly, adminGetCoupons);
router.get   ("/admin/analytics", protect, adminOnly, adminGetCouponAnalytics);
router.post  ("/admin",          protect, adminOnly, adminCreateCoupon);
router.put   ("/admin/:id",      protect, adminOnly, adminUpdateCoupon);
router.delete("/admin/:id",      protect, adminOnly, adminDeleteCoupon);
router.patch ("/admin/:id/toggle", protect, adminOnly, adminToggleCoupon);
export default router;
