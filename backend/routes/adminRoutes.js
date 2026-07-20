import express from 'express';
import { adminOnly, protect } from '../middlewares/authMiddleware.js';
import {
    getAllPincodes,
    createPincode,
    updatePincode,
    deletePincode,
} from '../controllers/admin/pincodeManager.js';
import {
    getUnreadCount,
    getNotifications,
    markAllAsRead,
    markAsRead,
    cleanOldNotifications
} from '../controllers/admin/notificationController.js';
import adminDeliveryRoutes from './admin/adminDeliveryRoutes.js';
import adminTicketRoutes from './admin/adminTicketRoutes.js';
import adminCannedResponseRoutes from './admin/adminCannedResponseRoutes.js';
import schedulerRoutes from './schedulerRoutes.js';
import {
    getAllVendors, getVendorDetail, approveVendor, rejectVendor, suspendVendor,
    updateCommission, deleteVendor, getAllDeliveryBoys, updateDeliveryBoyStatus,
    getOnlineRiders, activateVendorSubscription, deactivateVendorSubscription,
    adminGetAllSubscriptions, updateDeliveryDocStatus, updateVendorDocStatus,
} from '../controllers/admin/vendorApproval.js';
import {
    getAllSettlements, processWeeklySettlements, markSettlementPaid, markBatchPaid,
} from '../controllers/admin/settlementManager.js';
import {
    adminGetAllPayouts, adminApprovePayout, adminRejectPayout, adminCompletePayout,
} from '../controllers/admin/payoutController.js';
import {
    getVendorWalletAdmin, listWalletAdjustments, createWalletAdjustmentRequest,
    approveWalletAdjustment, rejectWalletAdjustment,
} from '../controllers/admin/walletAdjustmentController.js';
import { getDashboardStats, getMapData } from '../controllers/admin/dashboardController.js';
import { getOpsSummary, broadcastNotification, getBroadcastHistory } from '../controllers/admin/opsController.js';
import { auditLog } from '../validations/adminSecurityMiddleware.js';
import { validate } from '../middlewares/zodValidate.js';
import {
    approveVendorSchema, rejectVendorSchema, suspendVendorSchema, updateCommissionSchema,
    markSettlementPaidSchema, markBatchPaidSchema, rejectPayoutSchema, completePayoutSchema,
    createWalletAdjustmentSchema, rejectWalletAdjustmentSchema,
} from '../validations/adminFinance.schema.js';

const router = express.Router();

// All routes in this file are protected and admin-only
router.use(protect, adminOnly);

// Dashboard & Map
router.get("/dashboard", getDashboardStats);
router.get("/map-data", getMapData);

// Ops Dashboard — aggregates metrics with no existing endpoint; everything
// else it needs is read straight from the routes already declared in this
// file (dashboard, map-data, assignments/active, scheduler/*).
router.get("/ops-summary", getOpsSummary);
router.post("/broadcast", broadcastNotification);
router.get("/broadcast/history", getBroadcastHistory);

// Vendors
router.get("/vendors", getAllVendors);
router.get("/vendors/:id", getVendorDetail);
router.patch("/vendors/:id/approve", validate(approveVendorSchema), approveVendor);
router.patch("/vendors/:id/reject", validate(rejectVendorSchema), rejectVendor);
router.patch("/vendors/:id/suspend", validate(suspendVendorSchema), suspendVendor);
router.patch("/vendors/:id/commission", validate(updateCommissionSchema), updateCommission);
router.patch("/vendors/:id/document-status", auditLog("vendor_kyc_reviewed"), updateVendorDocStatus);
router.delete("/vendors/:id", deleteVendor);
router.post("/vendors/:id/subscription", auditLog("vendor_subscription_activated"), activateVendorSubscription);
router.patch("/vendors/:id/subscription/deactivate", auditLog("vendor_subscription_deactivated"), deactivateVendorSubscription);
router.get("/subscriptions", adminGetAllSubscriptions);

// Settlements
router.get("/settlements", getAllSettlements);
router.post("/settlements/process", processWeeklySettlements);
router.patch("/settlements/:id/paid", validate(markSettlementPaidSchema), markSettlementPaid);
router.patch("/settlements/batch/:batchId/paid", validate(markBatchPaidSchema), markBatchPaid);

// Payouts
router.get("/payouts", adminGetAllPayouts);
router.patch("/payouts/:id/approve", adminApprovePayout);
router.patch("/payouts/:id/reject", validate(rejectPayoutSchema), adminRejectPayout);
router.patch("/payouts/:id/complete", validate(completePayoutSchema), adminCompletePayout);

// Vendor Wallet — read-only + maker-checker manual adjustments
router.get("/vendors/:id/wallet", getVendorWalletAdmin);
router.get("/wallet-adjustments", listWalletAdjustments);
router.post("/wallet-adjustments", validate(createWalletAdjustmentSchema), auditLog("vendor_wallet_adjustment_requested"), createWalletAdjustmentRequest);
router.patch("/wallet-adjustments/:id/approve", auditLog("vendor_wallet_adjustment_approved"), approveWalletAdjustment);
router.patch("/wallet-adjustments/:id/reject", validate(rejectWalletAdjustmentSchema), auditLog("vendor_wallet_adjustment_rejected"), rejectWalletAdjustment);

// Delivery Boys
router.get("/delivery-boys", getAllDeliveryBoys);
router.get("/delivery-boys/online", getOnlineRiders);
router.patch("/delivery-boys/:id/status", updateDeliveryBoyStatus);
router.patch("/delivery-boys/:id/document-status", updateDeliveryDocStatus);

// Pincode Management Routes
// Matches GET /api/admin/pincodes
router.get('/pincodes', getAllPincodes);
router.post('/pincodes', createPincode);
router.put('/pincodes/:id', updatePincode);
router.delete('/pincodes/:id', deletePincode);

// Smart Assignment Engine
router.post("/orders/:id/assign-rider", async (req, res) => {
    try {
        const { adminForceAssign } = await import("../services/assignmentEngine.js");
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
router.post("/orders/:id/start-assignment", async (req, res) => {
    try {
        const { startAssignment } = await import("../services/assignmentEngine.js");
        await startAssignment(req.params.id);
        res.json({ success: true, message: "Assignment engine started" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to start assignment" });
    }
});
router.get("/assignments/active", async (req, res) => {
    try {
        const { getActiveAssignments } = await import("../services/assignmentEngine.js");
        res.json({ success: true, assignments: getActiveAssignments() });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed" });
    }
});

// Notification Routes
router.get('/notifications', getNotifications);
router.get('/notifications/unread', getUnreadCount);
router.put('/notifications/read-all', markAllAsRead);
router.put('/notifications/:id/read', markAsRead);
router.delete('/notifications/clean', cleanOldNotifications);

// Admin Delivery Management Routes
router.use('/delivery', adminDeliveryRoutes);

// Admin Support Ticket Routes
router.use('/tickets', adminTicketRoutes);

// Admin Canned Responses (support reply templates)
router.use('/canned-responses', adminCannedResponseRoutes);

// Scheduler routes (from original server.js)
router.use(schedulerRoutes);

export default router;