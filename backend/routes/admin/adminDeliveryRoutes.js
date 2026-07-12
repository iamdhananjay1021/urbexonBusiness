/**
 * adminDeliveryRoutes.js — Admin Delivery Management Routes
 */

import express from "express";
import { authenticateToken, authorizeRole } from "../../middlewares/authMiddleware.js";
import adminDeliveryPartnerController from "../../controllers/admin/adminDeliveryPartnerController.js";
import adminApplicationController from "../../controllers/admin/adminApplicationController.js";
import adminKYCController from "../../controllers/admin/adminKYCController.js";
import adminWalletController from "../../controllers/admin/adminWalletController.js";
import adminSettlementController from "../../controllers/admin/adminSettlementController.js";
import adminZoneController from "../../controllers/admin/adminZoneController.js";

const router = express.Router();

// ── Middleware ──
router.use(authenticateToken, authorizeRole("admin", "owner"));

// ── Delivery Partners ──
router.get("/partners", adminDeliveryPartnerController.listDeliveryPartners);
router.get("/partners/:id", adminDeliveryPartnerController.getDeliveryPartnerDetails);
router.patch("/partners/:id/status", adminDeliveryPartnerController.updateDeliveryPartnerStatus);
router.patch("/partners/:id/block", adminDeliveryPartnerController.blockDeliveryPartner);
router.patch("/partners/:id/unblock", adminDeliveryPartnerController.unblockDeliveryPartner);
router.post("/partners/:id/force-logout", adminDeliveryPartnerController.forceLogoutDeliveryPartner);
router.get("/partners/:id/metrics", adminDeliveryPartnerController.getPartnerMetrics);

// ── Applications ──
router.get("/applications", adminApplicationController.listApplications);
router.get("/applications/stats", adminApplicationController.getApplicationStats);
router.get("/applications/:id", adminApplicationController.getApplicationDetails);
router.post("/applications/:id/approve", adminApplicationController.approveDeliveryApplication);
router.post("/applications/:id/reject", adminApplicationController.rejectDeliveryApplication);
router.post("/applications/bulk/approve", adminApplicationController.bulkApproveApplications);

// ── KYC ──
router.get("/kyc", adminKYCController.listPendingKYC);
router.get("/kyc/:id", adminKYCController.getKYCDetails);
router.patch("/kyc/:id/aadhaar", adminKYCController.verifyAadhaar);
router.patch("/kyc/:id/pan", adminKYCController.verifyPAN);
router.post("/kyc/:id/approve", adminKYCController.approveKYCRecord);
router.post("/kyc/:id/reject", adminKYCController.rejectKYCRecord);

// ── Wallets ──
router.get("/wallets", adminWalletController.listWallets);
router.get("/wallets/:id", adminWalletController.getWalletDetails);
router.patch("/wallets/:id/adjust", adminWalletController.adjustWalletBalance);
router.get("/wallets/:id/transactions", adminWalletController.getWalletTransactions);

// ── Settlements ──
router.get("/settlements", adminSettlementController.listSettlements);
router.get("/settlements/:id", adminSettlementController.getSettlementDetails);
router.post("/settlements/:id/calculate", adminSettlementController.calculateSettlementCycle);
router.post("/settlements/:id/approve", adminSettlementController.approveSettlementCycle);
router.post("/settlements/:id/payout/initiate", adminSettlementController.initiateSettlementPayout);
router.post("/settlements/:id/payout/complete", adminSettlementController.completeSettlementPayout);

// ── Zones ──
router.get("/zones", adminZoneController.listZones);
router.post("/zones", adminZoneController.createDeliveryZone);
router.get("/zones/:id", adminZoneController.getZoneDetails);
router.patch("/zones/:id", adminZoneController.updateDeliveryZone);
router.post("/zones/:id/assign-partner", adminZoneController.assignPartnerToZone);
router.delete("/zones/:id/partners/:partnerId", adminZoneController.removePartnerFromZone);
router.get("/zones/:id/partners", adminZoneController.getZonePartnersList);

export default router;
