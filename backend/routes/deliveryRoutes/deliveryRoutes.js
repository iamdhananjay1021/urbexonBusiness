/**
 * deliveryRoutes.js — v3.1
 * ✅ GPS location rate limiter (max 120/min — prevents update spam)
 * ✅ Pincode-based delivery area validation on register
 */
import express from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { validateBody } from "../../middlewares/validate.js";
import { protect, deliveryOnly } from "../../middlewares/authMiddleware.js";
import { deliveryLogin } from "../../controllers/authController.js";
import {
    registerDeliveryBoy, getDeliveryStatus, toggleOnlineStatus,
    getDeliveryOrders, acceptOrder, pickupOrder, markDelivered,
    updateRiderLocation, getDeliveryEarnings, updateDeliveryProfile,
    getRiderLocationForOrder, rejectOrder, cancelOrder, saveFcmToken,
    updateDeliveryStatus, updateDeliveryDocuments, reportDeliveryIssue,
} from "../../controllers/delivery/deliveryController.js";
import {
    deliveryUpdateBankDetails, deliveryRequestPayout, deliveryGetPayouts,
} from "../../controllers/admin/payoutController.js";
import { getMyNotifications, getMyUnreadCount, markMyNotificationRead, markAllMyNotificationsRead } from "../../controllers/platformNotificationController.js";
import {
    createDeliveryTicket, getMyDeliveryTickets, getMyDeliveryTicketDetail,
    replyToMyDeliveryTicket, rateMyDeliveryTicket, reopenMyDeliveryTicket,
} from "../../controllers/delivery/deliveryTicketController.js";

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
router.post(
    "/login",
    validateBody({
        password: { required: true },
    }),
    deliveryLogin
);

router.post("/register", protect, docUpload, validateBody({
    name: { required: true, minLength: 2 },
    phone: { required: true, pattern: /^[6-9]\d{9}$/ },
    vehicleType: { required: true, enum: ['bicycle', 'scooter', 'motorcycle', 'car', 'other'] },
    dateOfBirth: { required: true },
    gender: { required: true, enum: ['male', 'female', 'other'] },
    houseNumber: { required: true, minLength: 1 },
    area: { required: true, minLength: 2 },
    city: { required: true, minLength: 2 },
    district: { required: true, minLength: 2 },
    state: { required: true, minLength: 2 },
    pincode: { required: true, pattern: /^\d{6}$/ },
    latitude: { required: true, type: 'number' },
    longitude: { required: true, type: 'number' },
    accountHolder: { required: true, minLength: 2 },
    bankName: { required: true, minLength: 2 },
    accountNumber: { required: true, pattern: /^\d{9,18}$/ },
    ifsc: { required: true, pattern: /^[A-Z]{4}0[A-Z0-9]{6}$/ },
    upiId: { required: true },
    emergencyContactName: { required: true, minLength: 2 },
    emergencyContactPhone: { required: true, pattern: /^[6-9]\d{9}$/ },
}), registerDeliveryBoy);
router.get("/status", protect, deliveryOnly, getDeliveryStatus);
router.patch("/toggle-status", protect, deliveryOnly, toggleOnlineStatus);

// ✅ FIX: Replaced placeholder with the actual controller to fetch orders.
router.get("/orders", protect, deliveryOnly, getDeliveryOrders);
router.patch("/orders/:id/accept", protect, deliveryOnly, acceptOrder);
router.patch("/orders/:id/pickup", protect, deliveryOnly, pickupOrder);
router.patch("/orders/:id/deliver", protect, deliveryOnly, validateBody({ otp: { required: true, minLength: 4, maxLength: 6 } }), markDelivered);
// GPS location updates — allow high frequency (every 5-15s per rider)
const locationLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false, keyGenerator: (req) => req.user?._id?.toString() || req.ip });
router.patch("/location", protect, deliveryOnly, locationLimiter, validateBody({ lat: { required: true, type: 'number' }, lng: { required: true, type: 'number' } }), updateRiderLocation);
router.get("/earnings", protect, deliveryOnly, getDeliveryEarnings);

// ── Delivery Notifications (persisted history — survives refresh) ──────────
// BUG FIX: delivery riders had zero way to read back their own persisted
// PlatformNotification history — see platformNotificationController.js.
router.get("/notifications", protect, deliveryOnly, getMyNotifications("delivery"));
router.get("/notifications/unread", protect, deliveryOnly, getMyUnreadCount("delivery"));
router.put("/notifications/read-all", protect, deliveryOnly, markAllMyNotificationsRead("delivery"));
router.put("/notifications/:id/read", protect, deliveryOnly, markMyNotificationRead("delivery"));
// ── Delivery Support Tickets (mirror of /api/vendor/tickets) ────────────────
const ticketAttachments = upload.array("attachments", 3);
router.post("/tickets", protect, deliveryOnly, ticketAttachments, createDeliveryTicket);
router.get("/tickets", protect, deliveryOnly, getMyDeliveryTickets);
router.get("/tickets/:id", protect, deliveryOnly, getMyDeliveryTicketDetail);
router.post("/tickets/:id/reply", protect, deliveryOnly, ticketAttachments, replyToMyDeliveryTicket);
router.post("/tickets/:id/rate", protect, deliveryOnly, rateMyDeliveryTicket);
router.post("/tickets/:id/reopen", protect, deliveryOnly, reopenMyDeliveryTicket);

router.patch("/profile", protect, deliveryOnly, updateDeliveryProfile);
router.patch("/documents", protect, deliveryOnly, docUpload, updateDeliveryDocuments);
router.patch("/bank-details", protect, deliveryOnly, deliveryUpdateBankDetails);
router.get("/payouts", protect, deliveryOnly, deliveryGetPayouts);
router.post("/payouts/request", protect, deliveryOnly, deliveryRequestPayout);

router.get("/orders/:id/rider-location", protect, getRiderLocationForOrder);

// ── New v3.0 endpoints ──
router.patch("/orders/:id/reject", protect, deliveryOnly, rejectOrder);
router.patch("/orders/:id/cancel", protect, deliveryOnly, cancelOrder);
router.patch("/orders/:id/status", protect, deliveryOnly, validateBody({ status: { required: true } }), updateDeliveryStatus);
router.patch("/orders/:id/report-issue", protect, deliveryOnly, reportDeliveryIssue);
router.patch("/fcm-token", protect, deliveryOnly, validateBody({ token: { required: true } }), saveFcmToken);

export default router;
