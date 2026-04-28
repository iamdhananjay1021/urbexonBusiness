import express from 'express';
import { adminOnly, protect } from '../middlewares/authMiddleware.js';
import {
    getAllPincodes,
    createPincode,
    updatePincode,
    deletePincode,
} from '../controllers/admin/pincodeManager.js';
import { getUnreadCount } from '../controllers/admin/notificationController.js';
import schedulerRoutes from './schedulerRoutes.js';
import {
    getAllVendors, getVendorDetail, approveVendor, rejectVendor, suspendVendor,
    updateCommission, deleteVendor, getAllDeliveryBoys, updateDeliveryBoyStatus,
    getOnlineRiders, activateVendorSubscription, deactivateVendorSubscription,
    adminGetAllSubscriptions, updateDeliveryDocStatus,
} from '../controllers/admin/vendorApproval.js';
import {
    getAllSettlements, processWeeklySettlements, markSettlementPaid, markBatchPaid,
} from '../controllers/admin/settlementManager.js';
import {
    adminGetAllPayouts, adminApprovePayout, adminRejectPayout, adminCompletePayout,
} from '../controllers/admin/payoutController.js';
import { getDashboardStats, getMapData } from '../controllers/admin/dashboardController.js';

const router = express.Router();

// All routes in this file are protected and admin-only
router.use(protect, adminOnly);

// Dashboard & Map
router.get("/dashboard", getDashboardStats);
router.get("/map-data", getMapData);

// Vendors
router.get("/vendors", getAllVendors);
router.get("/vendors/:id", getVendorDetail);
router.patch("/vendors/:id/approve", approveVendor);
router.patch("/vendors/:id/reject", rejectVendor);
router.patch("/vendors/:id/suspend", suspendVendor);
router.patch("/vendors/:id/commission", updateCommission);
router.delete("/vendors/:id", deleteVendor);
router.post("/vendors/:id/subscription", activateVendorSubscription);
router.patch("/vendors/:id/subscription/deactivate", deactivateVendorSubscription);
router.get("/subscriptions", adminGetAllSubscriptions);

// Settlements
router.get("/settlements", getAllSettlements);
router.post("/settlements/process", processWeeklySettlements);
router.patch("/settlements/:id/paid", markSettlementPaid);
router.patch("/settlements/batch/:batchId/paid", markBatchPaid);

// Payouts
router.get("/payouts", adminGetAllPayouts);
router.patch("/payouts/:id/approve", adminApprovePayout);
router.patch("/payouts/:id/reject", adminRejectPayout);
router.patch("/payouts/:id/complete", adminCompletePayout);

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
// Matches GET /api/admin/notifications/unread
router.get('/notifications/unread', getUnreadCount);

// Scheduler routes (from original server.js)
router.use(schedulerRoutes);

export default router;