/**
 * authRoutes.js — Production ready
 * All auth + admin dashboard routes
 */
import express from "express";
import { validateBody } from "../middlewares/validate.js";
import { protect, adminOnly } from "../middlewares/authMiddleware.js";
import {
    register, login, adminLogin,
    verifyOtp, resendOtp, refreshToken,
    getProfile, updateProfile, changePassword, saveLocation,
    getAllUsers,
    forgotPassword, resetPassword,
    adminForgotPassword, adminResetPassword,
    vendorForgotPassword, vendorResetPassword,
    deliveryForgotPassword, deliveryResetPassword,
    adminGetDashboard,
} from "../controllers/authController.js";

const router = express.Router();

/* ── Public auth ── */
router.post("/register",
    validateBody({
        name: { required: true, minLength: 2, maxLength: 100 },
        email: { required: true, type: "email" },
        phone: { required: true, pattern: /^[6-9]\d{9}$/ },
        password: { required: true, minLength: 8 },
    }),
    register,
);

router.post("/login",
    validateBody({
        email: { required: true, type: "email" },
        password: { required: true },
    }),
    login,
);

router.post("/verify-otp",
    validateBody({
        email: { required: true, type: "email" },
        otp: { required: true, minLength: 4, maxLength: 6 },
    }),
    verifyOtp,
);

router.post("/resend-otp",
    validateBody({ email: { required: true, type: "email" } }),
    resendOtp,
);

router.post("/refresh", refreshToken);

/* ── User password reset ── */
router.post("/forgot-password",
    validateBody({ email: { required: true, type: "email" } }),
    forgotPassword,
);

router.post("/reset-password/:token",
    validateBody({ password: { required: true, minLength: 8 } }),
    resetPassword,
);

/* ── Admin auth ── */
router.post("/admin/login",
    validateBody({
        email: { required: true, type: "email" },
        password: { required: true },
    }),
    adminLogin,
);

router.post("/admin/forgot-password",
    validateBody({ email: { required: true, type: "email" } }),
    adminForgotPassword,
);

router.post("/admin/reset-password/:token",
    validateBody({ password: { required: true, minLength: 8 } }),
    adminResetPassword,
);

/* ── Vendor password reset ── */
router.post("/vendor/forgot-password",
    validateBody({ email: { required: true, type: "email" } }),
    vendorForgotPassword,
);

router.post("/vendor/reset-password/:token",
    validateBody({ password: { required: true, minLength: 8 } }),
    vendorResetPassword,
);

/* ── Delivery password reset ── */
router.post("/delivery/forgot-password",
    validateBody({ email: { required: true, type: "email" } }),
    deliveryForgotPassword,
);

router.post("/delivery/reset-password/:token",
    validateBody({ password: { required: true, minLength: 8 } }),
    deliveryResetPassword,
);

/* ── Protected user routes ── */
router.get("/profile", protect, getProfile);
router.put("/profile", protect, validateBody({ name: { required: true, minLength: 2, maxLength: 100 } }), updateProfile);
router.put("/change-password", protect, validateBody({ currentPassword: { required: true }, newPassword: { required: true, minLength: 8 } }), changePassword);
router.post("/save-location", protect, saveLocation);

/* ── Admin only ── */
router.get("/users", protect, adminOnly, getAllUsers);
router.get("/admin/dashboard", protect, adminOnly, adminGetDashboard);

export default router;