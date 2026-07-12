/**
 * User.js — Updated with vendor & delivery_boy roles
 * FIX: Added `originalRole` field so vendor/delivery registration intent
 *      is preserved across the OTP verification step.
 */

import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
    {
        label: { type: String, trim: true, maxlength: 30, default: "Home" },
        name: { type: String, required: true, trim: true, maxlength: 100 },
        phone: { type: String, required: true, trim: true, match: [/^[6-9]\d{9}$/, "Invalid phone number"] },
        house: { type: String, required: true, trim: true, maxlength: 200 },
        area: { type: String, required: true, trim: true, maxlength: 200 },
        landmark: { type: String, trim: true, maxlength: 100, default: "" },
        city: { type: String, required: true, trim: true, maxlength: 100 },
        state: { type: String, required: true, trim: true, maxlength: 100 },
        pincode: { type: String, required: true, trim: true, match: [/^\d{6}$/, "Invalid pincode"] },
        isDefault: { type: Boolean, default: false },
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
    },
    { timestamps: true }
);

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Name is required"],
            trim: true,
            maxlength: [100, "Name cannot exceed 100 characters"],
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, "Please enter a valid email"],
        },
        password: {
            type: String,
            required: [true, "Password is required"],
            minlength: [8, "Password must be at least 8 characters"],
            select: false,
        },
        phone: {
            type: String,
            trim: true,
            validate: {
                validator: function (v) {
                    return !v || /^[6-9]\d{9}$/.test(v);
                },
                message: "Please enter a valid 10-digit Indian mobile number",
            },
        },

        // ── Google OAuth ──
        googleId: { type: String, unique: true, sparse: true },

        // ── ROLES: user | vendor | delivery_boy | admin | owner ──
        role: {
            type: String,
            enum: ["user", "vendor", "delivery_boy", "admin", "owner"],
            default: "user",
        },

        // ── FIX: Store original intended role during registration ──
        // When vendor/delivery_boy registers, they are created as 'user' first
        // (pending email verification). This field remembers their intended role
        // so after OTP verification we can redirect them to the correct panel.
        // Cleared after role is properly assigned or application is processed.
        originalRole: {
            type: String,
            enum: ["user", "vendor", "delivery_boy", null],
            default: null,
        },

        // ── Email Verification ──
        isEmailVerified: { type: Boolean, default: false },
        emailOtp: { type: String, default: undefined, select: false },
        emailOtpExpires: { type: Date, default: undefined, select: false },
        emailOtpAttempts: { type: Number, default: 0, select: false },

        // ── GPS Location ──
        location: {
            latitude: { type: Number, default: null },
            longitude: { type: Number, default: null },
            city: { type: String, trim: true, default: null },
            state: { type: String, trim: true, default: null },
            updatedAt: { type: Date, default: null },
        },

        // ── Saved Delivery Addresses (max 5) ──
        addresses: {
            type: [addressSchema],
            validate: { validator: (arr) => arr.length <= 5, message: "Maximum 5 addresses allowed" },
            default: [],
        },

        // ── Saved Urbexon Hour Pincode ──
        uhPincode: {
            code: { type: String, trim: true, match: [/^\d{6}$/, "Invalid pincode"], default: null },
            area: { type: String, trim: true, default: null },
            city: { type: String, trim: true, default: null },
            state: { type: String, trim: true, default: null },
            savedAt: { type: Date, default: null },
        },

        // ── Push notification token (web/FCM) — no client registration flow
        // exists yet to populate this; the field is additive schema support
        // so notificationEngine.js can send push the moment one does. ──
        fcmToken: { type: String, default: null },

        // ── Notification channel preferences — all default to "on" so
        // existing users see zero behavior change until they explicitly
        // opt out of something. ──
        notificationPreferences: {
            sound: { type: Boolean, default: true },
            muted: { type: Boolean, default: false },
            push: { type: Boolean, default: true },
            email: { type: Boolean, default: true },
            sms: { type: Boolean, default: true },
            marketing: { type: Boolean, default: true },
            transactional: { type: Boolean, default: true },
        },

        // ── Password Reset ──
        passwordResetToken: { type: String, default: undefined, select: false },
        passwordResetExpires: { type: Date, default: undefined, select: false },

        // ── Two-Factor Authentication (2FA) ──
        is2faEnabled: { type: Boolean, default: false },
        twoFactorSecret: { type: String, select: false },

        // ── Block ──
        isBlocked: { type: Boolean, default: false },
        blockedAt: { type: Date, default: null },

        // ── Soft delete ──
        isDeleted: { type: Boolean, default: false },

        // ── Session management ──
        // BUG FIX: authController.js (issueTokens/refreshToken/logoutAllDevices/
        // changePassword/toggleBlockUser/adminResetPassword) has always read
        // and written `refreshToken`, `refreshTokenExpires`, and `tokenVersion`
        // on the user document, but none of these paths were declared on this
        // schema. Mongoose's default `strict: true` silently drops any field
        // not in the schema on `.save()`, so the refresh token was NEVER
        // actually persisted to MongoDB — every `/api/auth/refresh` call after
        // the 15-minute access token expired queried for a `refreshToken` that
        // had never been written, always got no match, and always 403'd
        // ("Invalid or expired refresh token"). Declaring the fields here is
        // what makes issueTokens()'s existing `user.save()` actually store them.
        refreshToken: { type: String, select: false, default: undefined, index: true },
        refreshTokenExpires: { type: Date, select: false, default: undefined },
        tokenVersion: { type: Number, default: 0, select: false },

        // Multi-session refresh tokens: one entry per browser/panel session.
        // Replaces the single refreshToken field above (kept for migration —
        // refresh() falls back to it and converts it into a session entry).
        // Without this, logging in on a second device/panel invalidated the
        // first one's session, and concurrent multi-tab refreshes raced each
        // other into forced logouts.
        refreshSessions: {
            type: [
                {
                    token: { type: String, required: true },
                    scope: { type: String, enum: ["client", "vendor", "admin", "delivery"], default: "client" },
                    expiresAt: { type: Date, required: true },
                    createdAt: { type: Date, default: Date.now },
                    ip: String,
                    device: String,
                },
            ],
            select: false,
            default: undefined,
        },
    },
    { timestamps: true }
);

userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });
// Refresh lookup happens on every token refresh — must be indexed.
userSchema.index({ "refreshSessions.token": 1 });

export default mongoose.model("User", userSchema);