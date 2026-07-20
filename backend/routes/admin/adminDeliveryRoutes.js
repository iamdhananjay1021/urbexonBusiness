/**
 * adminDeliveryRoutes.js — Admin Delivery Management Routes
 */

import express from "express";
import { protect, adminOnly } from "../../middlewares/authMiddleware.js";
import adminDeliveryPartnerController from "../../controllers/admin/adminDeliveryPartnerController.js";
import adminApplicationController from "../../controllers/admin/adminApplicationController.js";
import adminKYCController from "../../controllers/admin/adminKYCController.js";
import adminWalletController from "../../controllers/admin/adminWalletController.js";
import adminSettlementController from "../../controllers/admin/adminSettlementController.js";
import adminZoneController from "../../controllers/admin/adminZoneController.js";
import { auditLog } from "../../validations/adminSecurityMiddleware.js";

const router = express.Router();

// ── Middleware ──
router.use(protect, adminOnly);

// ── Delivery Partners ──
// [FIX] These privileged actions (block/unblock/force-logout a rider) had
// no audit trail at all — the equivalent vendor-side actions in
// adminRoutes.js already use auditLog(); this was the one asymmetry
// between two otherwise-parallel admin systems.
router.get("/partners", adminDeliveryPartnerController.listDeliveryPartners);
router.get("/partners/:id", adminDeliveryPartnerController.getDeliveryPartnerDetails);
router.patch("/partners/:id/status", auditLog("delivery_partner_status_changed"), adminDeliveryPartnerController.updateDeliveryPartnerStatus);
router.patch("/partners/:id/block", auditLog("delivery_partner_blocked"), adminDeliveryPartnerController.blockDeliveryPartner);
router.patch("/partners/:id/unblock", auditLog("delivery_partner_unblocked"), adminDeliveryPartnerController.unblockDeliveryPartner);
router.post("/partners/:id/force-logout", auditLog("delivery_partner_force_logout"), adminDeliveryPartnerController.forceLogoutDeliveryPartner);
router.get("/partners/:id/metrics", adminDeliveryPartnerController.getPartnerMetrics);

// ── Applications ──
router.get("/applications", adminApplicationController.listApplications);
router.get("/applications/stats", adminApplicationController.getApplicationStats);
router.get("/applications/:id", adminApplicationController.getApplicationDetails);
router.post("/applications/:id/approve", auditLog("delivery_application_approved"), adminApplicationController.approveDeliveryApplication);
router.post("/applications/:id/reject", auditLog("delivery_application_rejected"), adminApplicationController.rejectDeliveryApplication);
router.post("/applications/bulk/approve", auditLog("delivery_application_bulk_approved"), adminApplicationController.bulkApproveApplications);

// ── KYC ──
router.get("/kyc", adminKYCController.listPendingKYC);
router.get("/kyc/:id", adminKYCController.getKYCDetails);
router.patch("/kyc/:id/aadhaar", auditLog("delivery_kyc_aadhaar_reviewed"), adminKYCController.verifyAadhaar);
router.patch("/kyc/:id/pan", auditLog("delivery_kyc_pan_reviewed"), adminKYCController.verifyPAN);
router.post("/kyc/:id/approve", auditLog("delivery_kyc_approved"), adminKYCController.approveKYCRecord);
router.post("/kyc/:id/reject", auditLog("delivery_kyc_rejected"), adminKYCController.rejectKYCRecord);

// ── Wallets ──
router.get("/wallets", adminWalletController.listWallets);
router.get("/wallets/:id", adminWalletController.getWalletDetails);
router.patch("/wallets/:id/adjust", auditLog("delivery_wallet_adjusted"), adminWalletController.adjustWalletBalance);
router.get("/wallets/:id/transactions", adminWalletController.getWalletTransactions);

// ── Settlements ──
router.get("/settlements", adminSettlementController.listSettlements);
router.get("/settlements/:id", adminSettlementController.getSettlementDetails);
router.post("/settlements/:id/calculate", adminSettlementController.calculateSettlementCycle);
router.post("/settlements/:id/approve", auditLog("delivery_settlement_approved"), adminSettlementController.approveSettlementCycle);
router.post("/settlements/:id/payout/initiate", auditLog("delivery_settlement_payout_initiated"), adminSettlementController.initiateSettlementPayout);
router.post("/settlements/:id/payout/complete", auditLog("delivery_settlement_payout_completed"), adminSettlementController.completeSettlementPayout);

// ── Zones ──
router.get("/zones", adminZoneController.listZones);
router.post("/zones", auditLog("delivery_zone_created"), adminZoneController.createDeliveryZone);
router.get("/zones/:id", adminZoneController.getZoneDetails);
router.patch("/zones/:id", auditLog("delivery_zone_updated"), adminZoneController.updateDeliveryZone);
router.post("/zones/:id/assign-partner", auditLog("delivery_zone_partner_assigned"), adminZoneController.assignPartnerToZone);
router.delete("/zones/:id/partners/:partnerId", auditLog("delivery_zone_partner_removed"), adminZoneController.removePartnerFromZone);
router.get("/zones/:id/partners", adminZoneController.getZonePartnersList);

export default router;
