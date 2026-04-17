/**
 * deliveryRoutes.js — v3.0 with validation + assignment engine
 */
import express from "express";
import multer from "multer";
import { validateBody } from "../../middlewares/validate.js";
import { protect, deliveryOnly } from "../../middlewares/authMiddleware.js";
import {
    registerDeliveryBoy, getDeliveryStatus, toggleOnlineStatus,
    getDeliveryOrders, acceptOrder, pickupOrder, markDelivered,
    updateRiderLocation, getDeliveryEarnings, updateDeliveryProfile,
    getRiderLocationForOrder, rejectOrder, cancelOrder, saveFcmToken,
    updateDeliveryStatus, updateDeliveryDocuments,
} from "../../controllers/delivery/deliveryController.js";
import {
    deliveryUpdateBankDetails, deliveryRequestPayout, deliveryGetPayouts,
} from "../../controllers/admin/payoutController.js";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
        allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error("Only images/PDFs allowed"), false);
    },
});

const docUpload = upload.fields([
    { name: "aadhaarPhoto", maxCount: 1 },
    { name: "licensePhoto", maxCount: 1 },
    { name: "vehicleRc", maxCount: 1 },
    { name: "selfie", maxCount: 1 },
]);

const router = express.Router();

router.post("/register", protect, docUpload, validateBody({ name: { required: true, minLength: 2 }, phone: { required: true, pattern: /^[6-9]\d{9}$/ }, vehicleType: { required: true, enum: ['bicycle', 'scooter', 'motorcycle', 'car', 'other'] } }), registerDeliveryBoy);
router.get("/status", protect, getDeliveryStatus);
router.patch("/toggle-status", protect, toggleOnlineStatus);
router.get("/orders", protect, getDeliveryOrders);
router.patch("/orders/:id/accept", protect, acceptOrder);
router.patch("/orders/:id/pickup", protect, pickupOrder);
router.patch("/orders/:id/deliver", protect, validateBody({ otp: { required: true, minLength: 4, maxLength: 6 } }), markDelivered);
router.patch("/location", protect, validateBody({ lat: { required: true, type: 'number' }, lng: { required: true, type: 'number' } }), updateRiderLocation);
router.get("/earnings", protect, getDeliveryEarnings);
router.patch("/profile", protect, updateDeliveryProfile);
router.patch("/documents", protect, docUpload, updateDeliveryDocuments);
router.patch("/bank-details", protect, deliveryOnly, deliveryUpdateBankDetails);
router.get("/payouts", protect, deliveryOnly, deliveryGetPayouts);
router.post("/payouts/request", protect, deliveryOnly, deliveryRequestPayout);

router.get("/orders/:id/rider-location", protect, getRiderLocationForOrder);

// ── New v3.0 endpoints ──
router.patch("/orders/:id/reject", protect, rejectOrder);
router.patch("/orders/:id/cancel", protect, cancelOrder);
router.patch("/orders/:id/status", protect, validateBody({ status: { required: true } }), updateDeliveryStatus);
router.patch("/fcm-token", protect, validateBody({ token: { required: true } }), saveFcmToken);

export default router;
