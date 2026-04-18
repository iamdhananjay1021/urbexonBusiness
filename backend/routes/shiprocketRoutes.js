/**
 * shiprocketRoutes.js
 */

import express from "express";
import { protect, adminOnly } from "../middlewares/authMiddleware.js";
import {
    getShippingRate,
    createShipment,
    trackOrder,
    getShippingLabel,
    getManifest,
    requestPickup,
    cancelShipment,
    shiprocketWebhook,
} from "../controllers/shiprocketController.js";

const router = express.Router();

// ── Public ──────────────────────────────────────────
router.post("/rate", getShippingRate);   // Checkout rate check
router.post("/webhook", shiprocketWebhook); // Shiprocket status updates

// ── User + Admin ─────────────────────────────────────
router.get("/track/:orderId", protect, trackOrder);

// ── Admin only ───────────────────────────────────────
router.post("/create/:orderId", protect, adminOnly, createShipment);
router.post("/cancel/:orderId", protect, adminOnly, cancelShipment);
router.get("/label/:orderId", protect, adminOnly, getShippingLabel);
router.get("/manifest/:orderId", protect, adminOnly, getManifest);
router.post("/pickup/:orderId", protect, adminOnly, requestPickup);

export default router;