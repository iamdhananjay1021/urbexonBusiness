/**
 * vendorRoutes.js — Production v2.3
 * Streamlined vendor registration and authentication routes.
 *
 * FIX (this version):
 *  - Added GET/PUT /settings routes. Previously these lived in a separate
 *    "settings.js" route file that was NEVER imported/mounted in server.js,
 *    AND that file referenced a non-existent "vendorOnly" middleware.
 *    Result: PUT /api/vendor/settings always 404'd, so the vendor "Serviceable
 *    Pincodes" field never actually saved to the DB — this is why Urbexon Hour
 *    homepage/category pages showed "0 verified stores" / no products even
 *    after clicking Save.
 *  - These new routes reuse the already-working protectVendor middleware and
 *    keep the exact request/response shape the VendorSettings.jsx frontend
 *    already expects (flat vendor object), so no frontend changes needed.
 */

import express from "express";
import multer from "multer";
import slugify from "slugify";

import { registerVendor, getVendorStatus } from "../../controllers/vendor/vendorAuth.js";
// QA FIX: was `login as vendorLogin` — the GENERIC login. That skipped the
// vendor role filter (any customer could log into the vendor panel) and set
// the wrong refresh-cookie scope (rt_client instead of rt_vendor).
import { vendorLogin } from "../../controllers/authController.js";
import { getFeaturedVendors, getVendorStore, getNearbyVendors } from "../../controllers/vendor/vendorPublic.js";
import { getMyProfile, updateMyProfile, toggleShopOpen, updateLocation, reuploadKycDocument } from "../../controllers/vendor/venderProfile.js";
import { getEarnings, getWeeklyEarnings, getSubscription, requestPlanChange, cancelPlanChangeRequest } from "../../controllers/vendor/vendorEarnings.js";
import {
    getSubscriptionPlans, createSubscriptionOrder,
    verifySubscriptionPayment, handleSubscriptionPaymentFailure,
    getSubscriptionPaymentHistory, validateSubscriptionCoupon,
} from "../../controllers/vendor/vendorSubscriptionPayment.js";
import { getVendorOrders, getVendorOrderById, updateOrderStatus } from "../../controllers/vendor/vendorOrders.js";
import { updateVendorBankDetails } from "../../controllers/vendor/bankDetailsController.js";
import { vendorRequestPayout, vendorGetPayouts, vendorCancelPayout } from "../../controllers/admin/payoutController.js";
import { getMyNotifications, getMyUnreadCount, markMyNotificationRead, markAllMyNotificationsRead } from "../../controllers/platformNotificationController.js";
import {
    createVendorTicket, getMyVendorTickets, getMyVendorTicketDetail,
    replyToMyVendorTicket, rateMyVendorTicket, reopenMyVendorTicket,
} from "../../controllers/vendor/vendorTicketController.js";
import {
    getMyVendorReviews, getVendorReviewStats,
    replyToReview, updateReviewReply, deleteReviewReply,
} from "../../controllers/vendor/vendorReviewController.js";
import {
    getMyWallet, getMyWalletTransactions,
    getMyWalletTransactionDetail, exportMyWalletTransactions,
} from "../../controllers/vendor/vendorWalletController.js";
import { getMyReturns, exportMyReturns, getMyReturnDetail } from "../../controllers/vendor/vendorReturnController.js";
import { protect } from "../../middlewares/authMiddleware.js";
import { validateBody } from "../../middlewares/validate.js";
import { protectVendor, requireApprovedVendor, requireActiveSubscription, blockSuspendedVendor } from "../../middlewares/vendorMiddleware.js";
import { auditLog } from "../../validations/adminSecurityMiddleware.js";
import Vendor from "../../models/vendorModels/Vendor.js";
import { delCacheByPrefix } from "../../utils/Cache.js";

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

// ── Vendor Login & Registration ─────────────────────────────────────────────
router.post("/login", vendorLogin);
router.post(
    "/register",
    protect, // User must be logged in to apply
    docUpload,
    validateBody({
        shopName: { required: true, minLength: 2, maxLength: 100 },
        ownerName: { required: true, minLength: 2 },
        phone: { required: true, pattern: /^[6-9]\d{9}$/ },
        email: { required: true, type: "email" },
        // Both optional — format is only checked when a value is actually
        // provided (validateBody's isEmpty guard skips the pattern check
        // otherwise). Structural format only, not a GSTIN-checksum or
        // government-API verification — that's a deliberately separate,
        // later concern.
        gstNumber: { uppercase: true, pattern: /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}Z[A-Z\d]{1}$/ },
        panNumber: { uppercase: true, pattern: /^[A-Z]{5}\d{4}[A-Z]{1}$/ },
    }),
    registerVendor,
);

// ── Vendor Status (user JWT) ──────────────────────────────────────────────────
router.get("/status", protect, getVendorStatus);

// ── Vendor Profile ────────────────────────────────────────────────────────────
router.get("/me", protectVendor, getMyProfile);
router.put("/me", protectVendor, requireApprovedVendor, docUpload, auditLog("vendor_profile_updated"), updateMyProfile);
router.patch("/toggle-shop", protectVendor, requireApprovedVendor, toggleShopOpen);
router.patch("/location", protectVendor, requireApprovedVendor, updateLocation);
router.post("/kyc/reupload", protectVendor, requireApprovedVendor, upload.single("document"), auditLog("vendor_kyc_reuploaded"), reuploadKycDocument);

// ── Vendor Notifications (persisted history — survives refresh) ─────────────
// BUG FIX: vendors had zero way to read back their own persisted
// PlatformNotification history — see platformNotificationController.js.
router.get("/notifications", protectVendor, blockSuspendedVendor, getMyNotifications("vendor"));
router.get("/notifications/unread", protectVendor, blockSuspendedVendor, getMyUnreadCount("vendor"));
router.put("/notifications/read-all", protectVendor, blockSuspendedVendor, markAllMyNotificationsRead("vendor"));
router.put("/notifications/:id/read", protectVendor, blockSuspendedVendor, markMyNotificationRead("vendor"));

// ── Vendor Support Tickets ───────────────────────────────────────────────────
// Guarded by requireApprovedVendor but deliberately NOT
// requireActiveSubscription — billing/subscription problems are a top
// ticket category, and a vendor locked out of support because their
// subscription lapsed couldn't report exactly that.
const ticketAttachments = upload.array("attachments", 3);
router.post("/tickets", protectVendor, requireApprovedVendor, ticketAttachments, createVendorTicket);
router.get("/tickets", protectVendor, requireApprovedVendor, getMyVendorTickets);
router.get("/tickets/:id", protectVendor, requireApprovedVendor, getMyVendorTicketDetail);
router.post("/tickets/:id/reply", protectVendor, requireApprovedVendor, ticketAttachments, replyToMyVendorTicket);
router.post("/tickets/:id/rate", protectVendor, requireApprovedVendor, rateMyVendorTicket);
router.post("/tickets/:id/reopen", protectVendor, requireApprovedVendor, reopenMyVendorTicket);

// ── Vendor Reviews & Replies ─────────────────────────────────────────────────
// No requireActiveSubscription — reading/responding to reviews on products
// already listed shouldn't be gated behind a lapsed subscription, matching
// the Support routes' precedent above.
router.get("/reviews", protectVendor, requireApprovedVendor, getMyVendorReviews);
router.get("/reviews/stats", protectVendor, requireApprovedVendor, getVendorReviewStats);
router.post("/reviews/:id/reply", protectVendor, requireApprovedVendor, auditLog("vendor_review_replied"), replyToReview);
router.put("/reviews/:id/reply", protectVendor, requireApprovedVendor, auditLog("vendor_review_reply_updated"), updateReviewReply);
router.delete("/reviews/:id/reply", protectVendor, requireApprovedVendor, auditLog("vendor_review_reply_deleted"), deleteReviewReply);

// ── Vendor Wallet (read-only — every mutation is a side-effect of
//    Settlement/Payout/ApprovalRequest flows, never a direct vendor write) ──
router.get("/wallet", protectVendor, requireApprovedVendor, getMyWallet);
router.get("/wallet/transactions", protectVendor, requireApprovedVendor, getMyWalletTransactions);
router.get("/wallet/transactions/export", protectVendor, requireApprovedVendor, exportMyWalletTransactions);
router.get("/wallet/transactions/:id", protectVendor, requireApprovedVendor, getMyWalletTransactionDetail);

// ── Vendor Settings (Shop info, delivery zone / service pincodes) ────────────
// ✅ FIX: previously lived in an unmounted route file with a broken middleware
// import ("vendorOnly" didn't exist). Rebuilt here using working middleware.
router.get("/settings", protectVendor, blockSuspendedVendor, async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.vendor._id).select(
            "shopName shopDescription shopCategory isOpen deliveryRadius servicePincodes location shopLat shopLng shopLogo shopBanner"
        );
        if (!vendor) return res.status(404).json({ message: "Vendor profile not found." });
        res.json(vendor);
    } catch (error) {
        console.error("[GET /vendor/settings]", error);
        res.status(500).json({ message: "Server error." });
    }
});

router.put("/settings", protectVendor, blockSuspendedVendor, async (req, res) => {
    try {
        const { shopName, shopDescription, isOpen, deliveryRadius, servicePincodes, lat, lng } = req.body;
        const vendor = await Vendor.findById(req.vendor._id);
        if (!vendor) return res.status(404).json({ message: "Vendor profile not found." });

        if (shopName !== undefined && shopName.trim() !== vendor.shopName) {
            vendor.shopName = shopName.trim();
            // Regenerate slug if shop name changes
            let baseSlug = slugify(vendor.shopName, { lower: true, strict: true });
            let slug = baseSlug;
            let count = 0;
            while (await Vendor.findOne({ shopSlug: slug, _id: { $ne: vendor._id } })) {
                slug = `${baseSlug}-${++count}`;
            }
            vendor.shopSlug = slug;
        }
        if (shopDescription !== undefined) vendor.shopDescription = shopDescription;
        if (isOpen !== undefined) vendor.isOpen = isOpen;
        if (deliveryRadius !== undefined) vendor.deliveryRadius = Number(deliveryRadius);

        // ✅ Accept servicePincodes as array (from VendorSettings.jsx TagInput) or JSON string
        if (servicePincodes !== undefined) {
            let pins = servicePincodes;
            if (typeof pins === "string") {
                try { pins = JSON.parse(pins); } catch { pins = []; }
            }
            vendor.servicePincodes = Array.isArray(pins) ? pins.map(p => String(p).trim()) : [];
        }

        if (lat !== undefined && lng !== undefined && lat !== null && lng !== null) {
            const latitude = parseFloat(lat);
            const longitude = parseFloat(lng);
            if (!isNaN(latitude) && !isNaN(longitude)) {
                vendor.shopLat = latitude;
                vendor.shopLng = longitude;
                vendor.location = {
                    type: "Point",
                    coordinates: [longitude, latitude],
                };
            }
        }

        await vendor.save();

        // ✅ Invalidate pincode/UH caches so the new servicePincodes take effect immediately
        try {
            await delCacheByPrefix("pincode:");
            await delCacheByPrefix("uh:");
        } catch (e) {
            console.warn("[Cache] Failed to invalidate cache after vendor settings update");
        }

        res.json({ message: "Settings saved successfully.", vendor });
    } catch (error) {
        console.error("[PUT /vendor/settings]", error);
        res.status(500).json({ message: "Server error saving settings." });
    }
});

// ── Vendor Orders ─────────────────────────────────────────────────────────────
router.get("/orders", protectVendor, requireApprovedVendor, requireActiveSubscription, getVendorOrders);
router.get("/orders/:id", protectVendor, requireApprovedVendor, requireActiveSubscription, getVendorOrderById);
router.patch(
    "/orders/:id/status",
    protectVendor, requireApprovedVendor, requireActiveSubscription,
    validateBody({ status: { required: true, enum: ["CONFIRMED", "PACKED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"] } }),
    updateOrderStatus,
);

// ── Vendor Returns & Refunds (read-only — every mutation still happens
//    through the existing admin processReturn flow in orderController.js;
//    this only adds a vendor-scoped view over Order.return) ──────────────
router.get("/returns", protectVendor, requireApprovedVendor, requireActiveSubscription, getMyReturns);
router.get("/returns/export", protectVendor, requireApprovedVendor, requireActiveSubscription, exportMyReturns);
router.get("/returns/:orderId", protectVendor, requireApprovedVendor, requireActiveSubscription, getMyReturnDetail);

// ── Vendor Earnings ───────────────────────────────────────────────────────────
router.get("/earnings", protectVendor, requireApprovedVendor, requireActiveSubscription, getEarnings);
router.get("/earnings/weekly", protectVendor, requireApprovedVendor, requireActiveSubscription, getWeeklyEarnings);
router.get("/subscription", protectVendor, blockSuspendedVendor, getSubscription);
router.post("/subscription/request-change", protectVendor, requireApprovedVendor, auditLog("vendor_subscription_change_requested"), requestPlanChange);
router.post("/subscription/cancel-request", protectVendor, requireApprovedVendor, auditLog("vendor_subscription_change_cancelled"), cancelPlanChangeRequest);

// ── Vendor Subscription Payment (Razorpay) ────────────────────────────────────
router.get("/subscription/plans", protectVendor, blockSuspendedVendor, getSubscriptionPlans);
router.post("/subscription/coupon/validate", protectVendor, requireApprovedVendor, validateSubscriptionCoupon);
router.post("/subscription/create-order", protectVendor, requireApprovedVendor, createSubscriptionOrder);
router.post("/subscription/verify-payment", protectVendor, requireApprovedVendor, verifySubscriptionPayment);
router.post("/subscription/payment-failed", protectVendor, requireApprovedVendor, handleSubscriptionPaymentFailure);
router.get("/subscription/payment-history", protectVendor, blockSuspendedVendor, getSubscriptionPaymentHistory);

// ── Vendor Payouts ────────────────────────────────────────────────────────────
router.get("/payouts", protectVendor, requireApprovedVendor, vendorGetPayouts);
router.post("/payouts/request", protectVendor, requireApprovedVendor, auditLog("vendor_withdrawal_requested"), vendorRequestPayout);
router.patch("/payouts/:id/cancel", protectVendor, requireApprovedVendor, vendorCancelPayout);

// ── Vendor Bank Details ───────────────────────────────────────────────────────
router.patch("/bank-details", protectVendor, requireApprovedVendor, auditLog("vendor_bank_details_updated"), updateVendorBankDetails);

export default router;