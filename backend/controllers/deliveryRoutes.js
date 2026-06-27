/**
 * deliveryRoutes.js
 * Routes for delivery partner operations.
 */

import express from "express";
import { registerDeliveryPartner, deliveryLogin } from "../controllers/delivery/deliveryBoyAuth.js";
import { protect } from "../middleware/authMiddleware.js";
import multer from "multer";

const router = express.Router();

// Multer setup for handling multipart/form-data (file uploads)
const storage = multer.memoryStorage();
const upload = multer({ storage });

/**
 * @route   POST /api/delivery/login
 * @desc    Login as a delivery partner
 * @access  Public
 */
router.post("/login", deliveryLogin);

/**
 * @route   POST /api/delivery/register
 * @desc    Register as a new delivery partner (application)
 * @access  Private (requires user authentication)
 */
router.post(
    "/register",
    protect, // Ensures user is logged in
    upload.fields([
        { name: "profilePhoto", maxCount: 1 },
        { name: "drivingLicensePhoto", maxCount: 1 },
        { name: "vehicleRCPhoto", maxCount: 1 },
        { name: "aadhaarPhoto", maxCount: 1 },
    ]),
    registerDeliveryPartner
);

export default router;