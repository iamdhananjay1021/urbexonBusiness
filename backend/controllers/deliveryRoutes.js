/**
 * deliveryRoutes.js
 * Routes for delivery partner operations.
 */

import express from "express";
import {
    registerDeliveryPartner,
    deliveryLogin,
    deliveryForgotPassword,
    deliveryResetPassword,
} from "../controllers/delivery/deliveryBoyAuth.js";
import { validateBody } from "../middlewares/validate.js";
import { protect } from "../middlewares/authMiddleware.js";
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
router.post("/login",
    validateBody({ password: { required: true } }),
    deliveryLogin
);

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

/**
 * @route   POST /api/delivery/forgot-password
 * @desc    Request password reset for a delivery partner
 * @access  Public
 */
router.post("/forgot-password",
    validateBody({ email: { required: true, type: "email" } }),
    deliveryForgotPassword
);

router.post("/reset-password/:token",
    validateBody({ password: { required: true, minLength: 8 } }),
    deliveryResetPassword
);

export default router;