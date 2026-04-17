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
import { getFeaturedVendors, getVendorStore, getNearbyVendors } from "../../controllers/vendor/vendorPublic.js";
import { getMyProfile, updateMyProfile, toggleShopOpen, updateLocation } from "../../controllers/vendor/venderProfile.js";
import { getEarnings, getWeeklyEarnings, getSubscription, requestPlanChange, cancelPlanChangeRequest } from "../../controllers/vendor/vendorEarnings.js";
import { getVendorOrders, updateOrderStatus } from "../../controllers/vendor/vendorOrders.js";
import {
    getAllVendors, getVendorDetail,
    approveVendor, rejectVendor, suspendVendor,
    updateCommission, deleteVendor,
    getAllDeliveryBoys, updateDeliveryBoyStatus, getOnlineRiders,
    activateVendorSubscription, updateDeliveryDocStatus,
} from "../../controllers/admin/vendorApproval.js";
import {
    getAllPincodes, createPincode, updatePincode,
    deletePincode, checkPincode, joinWaitlist,
} from "../../controllers/admin/pincodeManager.js";
import {
    getAllSettlements, processWeeklySettlements,
    markSettlementPaid, markBatchPaid,
} from "../../controllers/admin/settlementManager.js";
import {
    vendorRequestPayout, vendorGetPayouts, vendorCancelPayout,
    adminGetAllPayouts, adminApprovePayout, adminRejectPayout, adminCompletePayout,
} from "../../controllers/admin/payoutController.js";
import { getDashboardStats, getMapData } from "../../controllers/admin/dashboardController.js";
import { protect, adminOnly } from "../../middlewares/authMiddleware.js";
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
router.get("/pincode/check/:code", checkPincode);
router.post("/pincode/waitlist", joinWaitlist);
router.get("/vendor/featured", getFeaturedVendors);
router.get("/vendor/nearby", getNearbyVendors);
router.get("/vendor/store/:slug", getVendorStore);

// ── Vendor Registration (PUBLIC — no protect, auto creates user) ──────────────
router.post(
    "/vendor/register",
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
router.get("/vendor/status", protect, getVendorStatus);

// ── Vendor Profile ────────────────────────────────────────────────────────────
router.get("/vendor/me", protectVendor, getMyProfile);
router.put("/vendor/me", protectVendor, requireApprovedVendor, docUpload, updateMyProfile);
router.patch("/vendor/toggle-shop", protectVendor, requireApprovedVendor, toggleShopOpen);
router.patch("/vendor/location", protectVendor, requireApprovedVendor, updateLocation);

// ── Vendor Orders ─────────────────────────────────────────────────────────────
router.get("/vendor/orders", protectVendor, requireApprovedVendor, requireActiveSubscription, getVendorOrders);
router.patch("/vendor/orders/:id/status", protectVendor, requireApprovedVendor, requireActiveSubscription, updateOrderStatus);

// ── Vendor Earnings ───────────────────────────────────────────────────────────
router.get("/vendor/earnings", protectVendor, requireApprovedVendor, getEarnings);
router.get("/vendor/earnings/weekly", protectVendor, requireApprovedVendor, getWeeklyEarnings);
router.get("/vendor/subscription", protectVendor, getSubscription);
router.post("/vendor/subscription/request-change", protectVendor, requireApprovedVendor, requestPlanChange);
router.post("/vendor/subscription/cancel-request", protectVendor, requireApprovedVendor, cancelPlanChangeRequest);
// ── Vendor Payouts ────────────────────────────────────────────────────────
router.get("/vendor/payouts", protectVendor, requireApprovedVendor, vendorGetPayouts);
router.post("/vendor/payouts/request", protectVendor, requireApprovedVendor, vendorRequestPayout);
router.patch("/vendor/payouts/:id/cancel", protectVendor, requireApprovedVendor, vendorCancelPayout);
// ── Admin: Dashboard ──────────────────────────────────────────────────────────
router.get("/admin/dashboard", protect, adminOnly, getDashboardStats);
router.get("/admin/map-data", protect, adminOnly, getMapData);

// ── Admin: Vendors ────────────────────────────────────────────────────────────
router.get("/admin/vendors", protect, adminOnly, getAllVendors);
router.get("/admin/vendors/:id", protect, adminOnly, getVendorDetail);
router.patch("/admin/vendors/:id/approve", protect, adminOnly, approveVendor);
router.patch("/admin/vendors/:id/reject", protect, adminOnly, rejectVendor);
router.patch("/admin/vendors/:id/suspend", protect, adminOnly, suspendVendor);
router.patch("/admin/vendors/:id/commission", protect, adminOnly, updateCommission);
router.delete("/admin/vendors/:id", protect, adminOnly, deleteVendor);
router.post("/admin/vendors/:id/subscription", protect, adminOnly, activateVendorSubscription);

// ── Admin: Pincodes ───────────────────────────────────────────────────────────
router.get("/admin/pincodes", protect, adminOnly, getAllPincodes);
router.post("/admin/pincodes", protect, adminOnly, createPincode);
router.put("/admin/pincodes/:id", protect, adminOnly, updatePincode);
router.delete("/admin/pincodes/:id", protect, adminOnly, deletePincode);

// ── Admin: Settlements ────────────────────────────────────────────────────────
router.get("/admin/settlements", protect, adminOnly, getAllSettlements);
router.post("/admin/settlements/process", protect, adminOnly, processWeeklySettlements);
router.patch("/admin/settlements/:id/paid", protect, adminOnly, markSettlementPaid);
router.patch("/admin/settlements/batch/:batchId/paid", protect, adminOnly, markBatchPaid);

// ── Admin: Payouts ────────────────────────────────────────────────────────
router.get("/admin/payouts", protect, adminOnly, adminGetAllPayouts);
router.patch("/admin/payouts/:id/approve", protect, adminOnly, adminApprovePayout);
router.patch("/admin/payouts/:id/reject", protect, adminOnly, adminRejectPayout);
router.patch("/admin/payouts/:id/complete", protect, adminOnly, adminCompletePayout);

// ── Admin: Delivery Boys ──────────────────────────────────────────────────────
router.get("/admin/delivery-boys", protect, adminOnly, getAllDeliveryBoys);
router.get("/admin/delivery-boys/online", protect, adminOnly, getOnlineRiders);
router.patch("/admin/delivery-boys/:id/status", protect, adminOnly, updateDeliveryBoyStatus);
router.patch("/admin/delivery-boys/:id/document-status", protect, adminOnly, updateDeliveryDocStatus);

// ── Admin: Smart Assignment Engine ────────────────────────────────────────────
router.post("/admin/orders/:id/assign-rider", protect, adminOnly, async (req, res) => {
    try {
        const { adminForceAssign } = await import("../../services/assignmentEngine.js");
        const { riderId } = req.body;
        if (!riderId) return res.status(400).json({ success: false, message: "riderId required" });
        const result = await adminForceAssign(req.params.id, riderId);
        if (!result.success) return res.status(400).json(result);
        res.json({ success: true, message: `Assigned to ${result.rider?.name}`, order: result.order });
    } catch (err) {
        console.error("[adminForceAssign]", err);
        res.status(500).json({ success: false, message: "Failed to assign" });
    }
});

router.post("/admin/orders/:id/start-assignment", protect, adminOnly, async (req, res) => {
    try {
        const { startAssignment } = await import("../../services/assignmentEngine.js");
        await startAssignment(req.params.id);
        res.json({ success: true, message: "Assignment engine started" });
    } catch (err) {
        console.error("[startAssignment]", err);
        res.status(500).json({ success: false, message: "Failed to start assignment" });
    }
});

router.get("/admin/assignments/active", protect, adminOnly, async (req, res) => {
    try {
        const { getActiveAssignments } = await import("../../services/assignmentEngine.js");
        res.json({ success: true, assignments: getActiveAssignments() });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed" });
    }
});

export default router;