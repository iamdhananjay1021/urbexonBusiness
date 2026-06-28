/**
 * vendorRoutes.js
 * Routes for vendor-specific operations.
 */

import express from "express";
import {
    vendorLogin,
    vendorForgotPassword,
    vendorResetPassword,
} from "../controllers/authController.js";
import { validateBody } from "../middlewares/validate.js";

const router = express.Router();

/**
 * @route   POST /api/vendor/login
 * @desc    Login as a vendor
 * @access  Public
 */
router.post("/login",
    validateBody({ password: { required: true } }),
    vendorLogin
);

/**
 * @route   POST /api/vendor/forgot-password
 * @desc    Request password reset for a vendor
 * @access  Public
 */
router.post("/forgot-password",
    validateBody({ email: { required: true, type: "email" } }),
    vendorForgotPassword
);

router.post("/reset-password/:token",
    validateBody({ password: { required: true, minLength: 8 } }),
    vendorResetPassword
);

export default router;