/**
 * deliveryPartnerRoutes.js — Delivery Partner Routes
 */

import express from "express";
import { protect, deliveryOnly } from "../../middlewares/authMiddleware.js";
import deliveryAuthController from "../../controllers/delivery/deliveryAuthController.js";
import { updateRiderLocation } from "../../controllers/delivery/deliveryController.js";
import { handleRiderAccept, handleRiderReject } from "../../services/assignmentEngine.js";

const router = express.Router();

// ── Authentication (Public) ──
router.post("/register", deliveryAuthController.registerDeliveryPartner);
router.post("/login", deliveryAuthController.loginDeliveryPartner);
router.post("/refresh-token", deliveryAuthController.refreshToken);

// ── Protected Routes ──
router.use(protect, deliveryOnly);

// ── Status & Profile ──
router.get("/status", deliveryAuthController.getDeliveryStatus);
router.patch("/logout", deliveryAuthController.logoutDeliveryPartner);

// ── Location ──
router.patch("/location", updateRiderLocation);

// ── Orders ──
router.post("/orders/:orderId/accept", async (req, res) => {
    try {
        const db = await (await import("../../models/deliveryModels/DeliveryBoy.js")).default.findOne({
            userId: req.user._id,
        });
        if (!db) return res.status(404).json({ success: false, message: "Rider not found" });

        const result = await handleRiderAccept(req.params.orderId, db._id, req.user._id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to accept order" });
    }
});

router.post("/orders/:orderId/reject", async (req, res) => {
    try {
        const db = await (await import("../../models/deliveryModels/DeliveryBoy.js")).default.findOne({
            userId: req.user._id,
        });
        if (!db) return res.status(404).json({ success: false, message: "Rider not found" });

        await handleRiderReject(req.params.orderId, db._id);
        res.json({ success: true, message: "Order rejected" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to reject order" });
    }
});

// Future endpoints to be implemented:
// router.get("/orders/available", ...);
// router.get("/orders/active", ...);
// router.get("/orders/history", ...);
// router.get("/orders/:id", ...);
// router.patch("/orders/:id/pickup", ...);
// router.patch("/orders/:id/delivered", ...);
// router.get("/wallet", ...);
// router.get("/earnings/today", ...);
// router.get("/settlements", ...);
// router.post("/withdrawals", ...);
// router.get("/notifications", ...);

export default router;
