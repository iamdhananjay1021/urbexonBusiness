/**
 * vendorRoutes.js — Production v2.0
 * Clean, no duplicates, correct middleware usage
 *
 * PUBLIC:
 *   POST /vendor/register     → apply as vendor (auto creates user account)
 *   GET  /vendor/status       → check application status (needs user login)
 *   GET  /pincode/check/:code → check delivery availability
 *   POST /pincode/waitlist    → join waitlist
 *
 * VENDOR (protectVendor):
 *   GET    /vendor/me
 *   PUT    /vendor/me
 *   PATCH  /vendor/toggle-shop
 *   GET    /vendor/orders
 *   PATCH  /vendor/orders/:id/status
 *   GET    /vendor/earnings
 *   GET    /vendor/earnings/weekly
 *   GET    /vendor/subscription
 *
 * ADMIN (protect + adminOnly):
 *   All /admin/* routes
 */

import express from "express";
import multer from "multer";

import { registerVendor, getVendorStatus } from "../../controllers/vendor/vendorAuth.js";
import { sendVendorOtp, verifyVendorOtpRegister, vendorOtpLogin } from "../../controllers/authController.js";
import { getFeaturedVendors, getVendorStore, getNearbyVendors } from "../../controllers/vendor/vendorPublic.js";
import { getMyProfile, updateMyProfile, toggleShopOpen, updateLocation } from "../../controllers/vendor/venderProfile.js";
import { getEarnings, getWeeklyEarnings, getSubscription, requestPlanChange, cancelPlanChangeRequest } from "../../controllers/vendor/vendorEarnings.js";
import {
    getSubscriptionPlans, createSubscriptionOrder,
    verifySubscriptionPayment, handleSubscriptionPaymentFailure,
    getSubscriptionPaymentHistory,
} from "../../controllers/vendor/vendorSubscriptionPayment.js";
import { getVendorOrders, getVendorOrderById, updateOrderStatus } from "../../controllers/vendor/vendorOrders.js";
import { updateVendorBankDetails } from "../../controllers/vendor/bankDetailsController.js";
import { vendorRequestPayout, vendorGetPayouts, vendorCancelPayout } from "../../controllers/admin/payoutController.js";
import { protect } from "../../middlewares/authMiddleware.js";
import { validateBody } from "../../middlewares/validate.js";
import { protectVendor, requireApprovedVendor, requireActiveSubscription } from "../../middlewares/vendorMiddleware.js";

// ── Multer ────────────────────────────────────────────────────────────────────
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (_req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
        allowed.includes(file.mimetype)
            ? cb(null, true)
            : cb(new Error("Only JPG, PNG, WEBP, or PDF files are allowed"), false);
    },
});

const docUpload = upload.fields([
    { name: "shopLogo", maxCount: 1 },
    { name: "shopBanner", maxCount: 1 },
    { name: "shopPhoto", maxCount: 1 },
    { name: "ownerPhoto", maxCount: 1 },
    { name: "gstCertificate", maxCount: 1 },
    { name: "panCard", maxCount: 1 },
    { name: "cancelledCheque", maxCount: 1 },
    { name: "addressProof", maxCount: 1 },
]);

const router = express.Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.get("/featured", getFeaturedVendors);
router.get("/nearby", getNearbyVendors);
router.get("/store/:slug", getVendorStore);

// ── Vendor OTP Flow (Public)
router.post("/send-otp", validateBody({ email: { required: true, type: "email" } }), sendVendorOtp);
router.post("/verify-otp-register", validateBody({ email: { required: true, type: "email" }, otp: { required: true, minLength: 6, maxLength: 6 } }), verifyVendorOtpRegister);
router.post("/login-otp", validateBody({ email: { required: true, type: "email" }, otp: { required: true, minLength: 6, maxLength: 6 } }), vendorOtpLogin);



// ── Vendor Registration (PROTECTED — user must be logged in) ────────────────────
router.post(
    "/register",
    protect,  // ✅ REQUIRED: User must be authenticated with valid JWT
    docUpload,
    validateBody({
        shopName: { required: true, minLength: 2, maxLength: 100 },
        ownerName: { required: true, minLength: 2 },
        phone: { required: true, pattern: /^[6-9]\d{9}$/ },
        email: { required: true, type: "email" },
    }),
    registerVendor,
);

// ── Vendor Status (needs user JWT — not vendor JWT) ───────────────────────────
router.get("/status", protect, getVendorStatus);

// ── Vendor Profile ────────────────────────────────────────────────────────────
router.get("/me", protectVendor, getMyProfile);
router.put("/me", protectVendor, requireApprovedVendor, docUpload, updateMyProfile);
router.patch("/toggle-shop", protectVendor, requireApprovedVendor, toggleShopOpen);
router.patch("/location", protectVendor, requireApprovedVendor, updateLocation);

// ── Vendor Orders ─────────────────────────────────────────────────────────────
router.get("/orders", protectVendor, requireApprovedVendor, requireActiveSubscription, getVendorOrders);
router.get("/orders/:id", protectVendor, requireApprovedVendor, requireActiveSubscription, getVendorOrderById);
router.patch("/orders/:id/status", protectVendor, requireApprovedVendor, requireActiveSubscription, validateBody({ status: { required: true, enum: ["CONFIRMED", "PACKED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"] } }), updateOrderStatus);

// ── Vendor Earnings ───────────────────────────────────────────────────────────
router.get("/earnings", protectVendor, requireApprovedVendor, requireActiveSubscription, getEarnings);
router.get("/earnings/weekly", protectVendor, requireApprovedVendor, requireActiveSubscription, getWeeklyEarnings);
router.get("/subscription", protectVendor, getSubscription);
router.post("/subscription/request-change", protectVendor, requireApprovedVendor, requestPlanChange);
router.post("/subscription/cancel-request", protectVendor, requireApprovedVendor, cancelPlanChangeRequest);

// ── Vendor Subscription Payment (Razorpay) ────────────────────────────────
router.get("/subscription/plans", protectVendor, getSubscriptionPlans);
router.post("/subscription/create-order", protectVendor, requireApprovedVendor, createSubscriptionOrder);
router.post("/subscription/verify-payment", protectVendor, requireApprovedVendor, verifySubscriptionPayment);
router.post("/subscription/payment-failed", protectVendor, requireApprovedVendor, handleSubscriptionPaymentFailure);
router.get("/subscription/payment-history", protectVendor, getSubscriptionPaymentHistory);
// ── Vendor Payouts ────────────────────────────────────────────────────────
router.get("/payouts", protectVendor, requireApprovedVendor, vendorGetPayouts);
router.post("/payouts/request", protectVendor, requireApprovedVendor, vendorRequestPayout);
router.patch("/payouts/:id/cancel", protectVendor, requireApprovedVendor, vendorCancelPayout);

// ── Vendor Bank Details ──────────────────────────────────────────────────────
router.patch("/bank-details", protectVendor, requireApprovedVendor, updateVendorBankDetails);

export default router;
