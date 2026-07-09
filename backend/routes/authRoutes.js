/**
 * authRoutes.js — Production ready
 * All auth + admin dashboard routes
 *
 * [FIX] logout and logoutAllDevices existed in authController.js but were
 * never wired to any route — no panel (client/vendor/delivery/admin) could
 * actually call logout, so the refreshToken httpOnly cookie was never
 * cleared server-side and tokenVersion was never bumped on "logout all
 * devices". Added both routes below.
 */
import express from "express";
import { validateBody } from "../middlewares/validate.js";
import { protect, adminOnly } from "../middlewares/authMiddleware.js";
import {
    register, login, adminLogin,
    verifyOtp, resendOtp, refreshToken,
    getProfile, updateProfile, changePassword, saveLocation,
    getAllUsers, toggleBlockUser,
    forgotPassword, resetPassword,
    adminForgotPassword, adminResetPassword,
    adminGetDashboard,
    googleLogin,
    logout, logoutAllDevices, // [FIX] now imported
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

// [FIX] Logout — clears the httpOnly refreshToken cookie server-side.
// Public route: works purely off the cookie, no access-token required
// (mirrors how /refresh doesn't require `protect` either).
router.post("/logout", logout);

/* ── Google OAuth ── */
router.post("/google", googleLogin);

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

/* ── Protected user routes ── */
router.get("/profile", protect, getProfile);
router.put("/profile", protect, validateBody({ name: { required: true, minLength: 2, maxLength: 100 } }), updateProfile);
router.put("/change-password", protect, validateBody({ currentPassword: { required: true }, newPassword: { required: true, minLength: 8 } }), changePassword);
router.post("/save-location", protect, saveLocation);

// [FIX] Logout from all devices — requires a valid access token since it
// bumps tokenVersion on req.user, invalidating every other session's token.
router.post("/logout-all", protect, logoutAllDevices);

/* ── Admin only ── */
router.get("/users", protect, adminOnly, getAllUsers);
router.patch("/users/:id/toggle-block", protect, adminOnly, toggleBlockUser);
router.get("/admin/dashboard", protect, adminOnly, adminGetDashboard);

export default router;