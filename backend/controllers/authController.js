/**
 * authController.js — Production ready
 * Roles: user | vendor | delivery_boy | admin | owner
 */

import User from "../models/User.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Vendor from "../models/vendorModels/Vendor.js";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendEmailBackground } from "../utils/emailService.js";

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */
const OTP_EXPIRY_MS = 10 * 60 * 1000;   // 10 min
const RESET_EXPIRY_MS = 15 * 60 * 1000;   // 15 min
const MAX_OTP_ATTEMPTS = 5;
const BCRYPT_ROUNDS = 12;
const JWT_EXPIRY = "30d";

const BRAND = {
    name: process.env.SHOP_NAME || "Urbexon",
    email: process.env.SHOP_EMAIL || "officialurbexon@gmail.com",
    phone: process.env.SHOP_PHONE || "8808485840",
    website: process.env.SHOP_WEBSITE || "urbexon.in",
};

const PUBLIC_ROLES = ["user", "vendor", "delivery_boy"];

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
const generateToken = (id, role) =>
    jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRY });

const generateOtp = () =>
    Math.floor(100000 + Math.random() * 900000).toString();

const sanitizeEmail = (e) => e?.toLowerCase().trim();
const sanitizeName = (n) => n?.trim().slice(0, 100);

const safeUserPayload = (user, token) => ({
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    token,
});

/* ═══════════════════════════════════════════════════
   REGISTER
═══════════════════════════════════════════════════ */
export const register = async (req, res) => {
    try {
        const { name, email, phone, password, role } = req.body;

        if (!name?.trim() || !email?.trim() || !phone?.trim() || !password?.trim())
            return res.status(400).json({ success: false, message: "All fields are required" });

        if (!/^[6-9]\d{9}$/.test(phone.trim()))
            return res.status(400).json({ success: false, message: "Enter a valid 10-digit Indian mobile number" });

        if (password.length < 8)
            return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });

        const assignedRole = PUBLIC_ROLES.includes(role) ? role : "user";

        const exists = await User.findOne({ email: sanitizeEmail(email) })
            .select("+emailOtp +emailOtpExpires +emailOtpAttempts");

        if (exists && !exists.isEmailVerified) {
            const otp = generateOtp();
            exists.emailOtp = otp;
            exists.emailOtpExpires = Date.now() + OTP_EXPIRY_MS;
            exists.emailOtpAttempts = 0;
            await exists.save({ validateBeforeSave: false });
            sendEmailBackground(buildOtpEmail(exists.email, exists.name, otp));
            return res.status(200).json({ success: true, message: "OTP resent to your email", email: exists.email, requiresVerification: true });
        }

        if (exists)
            return res.status(400).json({ success: false, message: "An account with this email already exists" });

        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const otp = generateOtp();

        const user = await User.create({
            name: sanitizeName(name),
            email: sanitizeEmail(email),
            phone: phone.trim(),
            password: hashedPassword,
            role: assignedRole,
            isEmailVerified: false,
            emailOtp: otp,
            emailOtpExpires: Date.now() + OTP_EXPIRY_MS,
            emailOtpAttempts: 0,
        });

        sendEmailBackground(buildOtpEmail(user.email, user.name, otp, assignedRole));

        return res.status(201).json({
            success: true,
            message: "OTP sent to your email. Please verify to continue.",
            email: user.email,
            role: assignedRole,
            requiresVerification: true,
        });

    } catch (err) {
        console.error("[Auth] REGISTER ERROR:", err);
        return res.status(500).json({ success: false, message: "Registration failed. Please try again." });
    }
};

/* ═══════════════════════════════════════════════════
   VERIFY OTP
═══════════════════════════════════════════════════ */
export const verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email?.trim() || !otp?.trim())
            return res.status(400).json({ success: false, message: "Email and OTP are required" });

        const user = await User.findOne({ email: sanitizeEmail(email) })
            .select("+emailOtp +emailOtpExpires +emailOtpAttempts");

        if (!user)
            return res.status(404).json({ success: false, message: "No account found with this email" });

        if (user.isEmailVerified)
            return res.status(400).json({ success: false, message: "Email is already verified. Please login." });

        if ((user.emailOtpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
            user.emailOtp = undefined; user.emailOtpExpires = undefined; user.emailOtpAttempts = 0;
            await user.save({ validateBeforeSave: false });
            return res.status(429).json({ success: false, message: "Too many incorrect attempts. Please request a new OTP." });
        }

        if (!user.emailOtp || !user.emailOtpExpires)
            return res.status(400).json({ success: false, message: "OTP not found. Please request a new one." });

        if (user.emailOtpExpires < Date.now()) {
            user.emailOtp = undefined; user.emailOtpExpires = undefined; user.emailOtpAttempts = 0;
            await user.save({ validateBeforeSave: false });
            return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
        }

        const otpValid = crypto.timingSafeEqual(
            Buffer.from(user.emailOtp.toString()),
            Buffer.from(otp.trim().toString()),
        );

        if (!otpValid) {
            user.emailOtpAttempts = (user.emailOtpAttempts || 0) + 1;
            await user.save({ validateBeforeSave: false });
            const remaining = MAX_OTP_ATTEMPTS - user.emailOtpAttempts;
            return res.status(400).json({
                success: false,
                message: remaining > 0
                    ? `Invalid OTP. ${remaining} attempt${remaining > 1 ? "s" : ""} remaining.`
                    : "Too many incorrect attempts. Please request a new OTP.",
            });
        }

        user.isEmailVerified = true;
        user.emailOtp = undefined; user.emailOtpExpires = undefined; user.emailOtpAttempts = 0;
        await user.save();

        return res.status(200).json({ success: true, ...safeUserPayload(user, generateToken(user._id, user.role)) });

    } catch (err) {
        console.error("[Auth] VERIFY OTP ERROR:", err);
        return res.status(500).json({ success: false, message: "Verification failed. Please try again." });
    }
};

/* ═══════════════════════════════════════════════════
   RESEND OTP
═══════════════════════════════════════════════════ */
export const resendOtp = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email?.trim()) return res.status(400).json({ success: false, message: "Email is required" });

        const user = await User.findOne({ email: sanitizeEmail(email) })
            .select("+emailOtp +emailOtpExpires +emailOtpAttempts");
        if (!user) return res.status(404).json({ success: false, message: "No account found with this email" });
        if (user.isEmailVerified) return res.status(400).json({ success: false, message: "Email is already verified." });

        const otp = generateOtp();
        user.emailOtp = otp; user.emailOtpExpires = Date.now() + OTP_EXPIRY_MS; user.emailOtpAttempts = 0;
        await user.save({ validateBeforeSave: false });
        sendEmailBackground(buildOtpEmail(user.email, user.name, otp));
        return res.json({ success: true, message: "New OTP sent successfully" });

    } catch (err) {
        console.error("[Auth] RESEND OTP ERROR:", err);
        return res.status(500).json({ success: false, message: "Failed to resend OTP." });
    }
};

/* ═══════════════════════════════════════════════════
   LOGIN (user / vendor / delivery_boy)
═══════════════════════════════════════════════════ */
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email?.trim() || !password?.trim())
            return res.status(400).json({ success: false, message: "Email and password are required" });

        const user = await User.findOne({ email: sanitizeEmail(email) })
            .select("+password +emailOtp +emailOtpExpires +emailOtpAttempts");
        if (!user) return res.status(401).json({ success: false, message: "Invalid email or password" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ success: false, message: "Invalid email or password" });

        if (["admin", "owner"].includes(user.role))
            return res.status(403).json({ success: false, message: "Admin accounts must login via the Admin Panel." });

        if (user.isBlocked)
            return res.status(403).json({ success: false, message: "Your account has been blocked. Please contact support." });

        if (!user.isEmailVerified) {
            const otp = generateOtp();
            user.emailOtp = otp; user.emailOtpExpires = Date.now() + OTP_EXPIRY_MS; user.emailOtpAttempts = 0;
            await user.save({ validateBeforeSave: false });
            sendEmailBackground(buildOtpEmail(user.email, user.name, otp));
            return res.status(403).json({ success: false, message: "Please verify your email first. OTP sent.", requiresVerification: true, email: user.email });
        }

        return res.status(200).json({ success: true, ...safeUserPayload(user, generateToken(user._id, user.role)) });

    } catch (err) {
        console.error("[Auth] LOGIN ERROR:", err);
        return res.status(500).json({ success: false, message: "Login failed. Please try again." });
    }
};

/* ═══════════════════════════════════════════════════
   ADMIN LOGIN
═══════════════════════════════════════════════════ */
export const adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email?.trim() || !password?.trim())
            return res.status(400).json({ success: false, message: "Email and password are required" });

        const user = await User.findOne({ email: sanitizeEmail(email), role: { $in: ["admin", "owner"] } })
            .select("+password");

        if (!user) return res.status(401).json({ success: false, message: "Invalid credentials" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ success: false, message: "Invalid credentials" });

        return res.status(200).json({ success: true, ...safeUserPayload(user, generateToken(user._id, user.role)) });

    } catch (err) {
        console.error("[Auth] ADMIN LOGIN ERROR:", err);
        return res.status(500).json({ success: false, message: "Login failed." });
    }
};

/* ═══════════════════════════════════════════════════
   PROFILE
═══════════════════════════════════════════════════ */
export const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("-password");
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        res.json({ success: true, _id: user._id, name: user.name, email: user.email, phone: user.phone || "", role: user.role, addresses: user.addresses, location: user.location, createdAt: user.createdAt });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to fetch profile" });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const { name, phone } = req.body;
        if (!name?.trim()) return res.status(400).json({ success: false, message: "Name is required" });
        if (phone && !/^[6-9]\d{9}$/.test(phone.trim()))
            return res.status(400).json({ success: false, message: "Enter a valid 10-digit Indian mobile number" });

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        user.name = sanitizeName(name);
        if (phone !== undefined) user.phone = phone.trim();
        await user.save();

        res.json({ success: true, _id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to update profile" });
    }
};

/* ═══════════════════════════════════════════════════
   CHANGE PASSWORD
═══════════════════════════════════════════════════ */
export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword)
            return res.status(400).json({ success: false, message: "Both passwords required" });
        if (newPassword.length < 8)
            return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
        if (currentPassword === newPassword)
            return res.status(400).json({ success: false, message: "New password must be different" });

        const user = await User.findById(req.user._id).select("+password");
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ success: false, message: "Current password is incorrect" });

        user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        await user.save();
        res.json({ success: true, message: "Password changed successfully" });

    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to change password." });
    }
};

/* ═══════════════════════════════════════════════════
   SAVE LOCATION
═══════════════════════════════════════════════════ */
export const saveLocation = async (req, res) => {
    try {
        const { latitude, longitude, city, state } = req.body;
        if (latitude !== undefined && (latitude < -90 || latitude > 90))
            return res.status(400).json({ success: false, message: "Invalid latitude" });
        if (longitude !== undefined && (longitude < -180 || longitude > 180))
            return res.status(400).json({ success: false, message: "Invalid longitude" });

        await User.findByIdAndUpdate(req.user._id, {
            $set: {
                "location.latitude": latitude,
                "location.longitude": longitude,
                "location.city": city?.trim(),
                "location.state": state?.trim(),
                "location.updatedAt": new Date(),
            },
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to save location" });
    }
};

/* ═══════════════════════════════════════════════════
   GOOGLE LOGIN / SIGNUP (Firebase ID Token)
═══════════════════════════════════════════════════ */
export const googleLogin = async (req, res) => {
    try {
        const { idToken, role } = req.body;
        if (!idToken) return res.status(400).json({ success: false, message: "ID token is required" });

        const { getFirebaseAdmin } = await import("../config/firebase.js");
        const admin = getFirebaseAdmin();
        let decoded;
        try {
            decoded = await admin.auth().verifyIdToken(idToken);
        } catch {
            return res.status(401).json({ success: false, message: "Invalid or expired Google token" });
        }

        const { email, name, uid, picture } = decoded;
        if (!email) return res.status(400).json({ success: false, message: "Google account has no email" });

        let user = await User.findOne({ email: sanitizeEmail(email) });

        if (user) {
            // Existing user — login
            if (["admin", "owner"].includes(user.role))
                return res.status(403).json({ success: false, message: "Admin accounts must login via the Admin Panel." });

            // Link Google ID if not set
            if (!user.googleId) {
                user.googleId = uid;
                user.isEmailVerified = true;
                await user.save({ validateBeforeSave: false });
            }

            return res.json({ success: true, ...safeUserPayload(user, generateToken(user._id, user.role)) });
        }

        // New user — register
        const assignedRole = PUBLIC_ROLES.includes(role) ? role : "user";
        const randomPassword = crypto.randomBytes(32).toString("hex");
        const hashedPassword = await bcrypt.hash(randomPassword, BCRYPT_ROUNDS);

        user = await User.create({
            name: sanitizeName(name || email.split("@")[0]),
            email: sanitizeEmail(email),
            password: hashedPassword,
            phone: "",
            role: assignedRole,
            isEmailVerified: true,
            googleId: uid,
        });

        return res.status(201).json({ success: true, ...safeUserPayload(user, generateToken(user._id, user.role)) });
    } catch (err) {
        console.error("[Auth] GOOGLE LOGIN ERROR:", err);
        return res.status(500).json({ success: false, message: "Google sign-in failed. Please try again." });
    }
};

/* ═══════════════════════════════════════════════════
   GET ALL USERS (ADMIN)
═══════════════════════════════════════════════════ */
export const getAllUsers = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.search?.trim()) {
            const esc = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.$or = [
                { name: { $regex: esc, $options: "i" } },
                { email: { $regex: esc, $options: "i" } },
                { phone: { $regex: esc, $options: "i" } },
            ];
        }
        if (req.query.role) filter.role = req.query.role;

        const [users, total] = await Promise.all([
            User.find(filter).select("-password").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            User.countDocuments(filter),
        ]);

        res.json({ users, total, page, totalPages: Math.ceil(total / limit), limit });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to fetch users" });
    }
};

/* ═══════════════════════════════════════════════════
   BLOCK / UNBLOCK USER (ADMIN)
═══════════════════════════════════════════════════ */
export const toggleBlockUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        if (user.role === "admin" || user.role === "owner") return res.status(403).json({ success: false, message: "Cannot block admin/owner accounts" });

        user.isBlocked = !user.isBlocked;
        user.blockedAt = user.isBlocked ? new Date() : null;
        await user.save({ validateBeforeSave: false });

        res.json({ success: true, message: `User ${user.isBlocked ? "blocked" : "unblocked"} successfully`, isBlocked: user.isBlocked });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to update user status" });
    }
};

/* ═══════════════════════════════════════════════════
   FORGOT / RESET PASSWORD
═══════════════════════════════════════════════════ */
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email?.trim()) return res.status(400).json({ success: false, message: "Email is required" });
        const SAFE = { success: true, message: "If this email is registered, a reset link has been sent." };

        const user = await User.findOne({ email: sanitizeEmail(email) });
        if (!user) return res.json(SAFE);

        const resetToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");
        user.passwordResetToken = hashedToken;
        user.passwordResetExpires = Date.now() + RESET_EXPIRY_MS;
        await user.save({ validateBeforeSave: false });

        const resetUrl = `${process.env.FRONTEND_URL || process.env.CLIENT_URL}/reset-password/${resetToken}`;
        sendEmailBackground({ to: user.email, subject: `Reset Your Password — ${BRAND.name}`, html: buildResetEmail(user.name, resetUrl), label: "Auth/ForgotPassword" });
        res.json(SAFE);
    } catch (err) {
        res.status(500).json({ success: false, message: "Something went wrong." });
    }
};

export const resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;
        if (!token || !password?.trim())
            return res.status(400).json({ success: false, message: "Token and new password required" });
        if (password.length < 8)
            return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });

        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
        const user = await User.findOne({ passwordResetToken: hashedToken, passwordResetExpires: { $gt: Date.now() } });
        if (!user) return res.status(400).json({ success: false, message: "Reset link is invalid or has expired" });

        user.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
        res.json({ success: true, message: "Password reset successfully." });
    } catch (err) {
        res.status(500).json({ success: false, message: "Password reset failed." });
    }
};

export const adminForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email?.trim()) return res.status(400).json({ success: false, message: "Email is required" });
        const SAFE = { success: true, message: "If this email is registered, a reset link has been sent." };

        const admin = await User.findOne({ email: sanitizeEmail(email), role: { $in: ["admin", "owner"] } });
        if (!admin) return res.json(SAFE);

        const resetToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");
        admin.passwordResetToken = hashedToken;
        admin.passwordResetExpires = Date.now() + RESET_EXPIRY_MS;
        await admin.save({ validateBeforeSave: false });

        const resetUrl = `${process.env.ADMIN_FRONTEND_URL || process.env.CLIENT_URL}/admin/reset-password/${resetToken}`;
        sendEmailBackground({ to: admin.email, subject: `${BRAND.name} Admin — Password Reset`, html: buildAdminResetEmail(admin.name, resetUrl), label: "AdminAuth/ForgotPassword" });
        res.json(SAFE);
    } catch (err) {
        res.status(500).json({ success: false, message: "Something went wrong." });
    }
};

export const adminResetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;
        if (!token || !password?.trim())
            return res.status(400).json({ success: false, message: "Token and password required" });
        if (password.length < 8)
            return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });

        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
        const admin = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() },
            role: { $in: ["admin", "owner"] },
        });
        if (!admin) return res.status(400).json({ success: false, message: "Reset link is invalid or has expired" });

        admin.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
        admin.passwordResetToken = undefined;
        admin.passwordResetExpires = undefined;
        await admin.save();
        res.json({ success: true, message: "Password reset successfully." });
    } catch (err) {
        res.status(500).json({ success: false, message: "Password reset failed." });
    }
};

/* ═══════════════════════════════════════════════════
   VENDOR FORGOT / RESET PASSWORD
═══════════════════════════════════════════════════ */
export const vendorForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email?.trim()) return res.status(400).json({ success: false, message: "Email is required" });
        const SAFE = { success: true, message: "If this email is registered, a reset link has been sent." };

        const vendor = await User.findOne({ email: sanitizeEmail(email), role: "vendor" });
        if (!vendor) return res.json(SAFE);

        const resetToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");
        vendor.passwordResetToken = hashedToken;
        vendor.passwordResetExpires = Date.now() + RESET_EXPIRY_MS;
        await vendor.save({ validateBeforeSave: false });

        const resetUrl = `${process.env.VENDOR_FRONTEND_URL || "https://vendor.urbexon.in"}/reset-password/${resetToken}`;
        sendEmailBackground({ to: vendor.email, subject: `${BRAND.name} Vendor — Password Reset`, html: buildVendorResetEmail(vendor.name, resetUrl), label: "VendorAuth/ForgotPassword" });
        res.json(SAFE);
    } catch (err) {
        res.status(500).json({ success: false, message: "Something went wrong." });
    }
};

export const vendorResetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;
        if (!token || !password?.trim())
            return res.status(400).json({ success: false, message: "Token and password required" });
        if (password.length < 8)
            return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });

        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
        const vendor = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() },
            role: "vendor",
        });
        if (!vendor) return res.status(400).json({ success: false, message: "Reset link is invalid or has expired" });

        vendor.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
        vendor.passwordResetToken = undefined;
        vendor.passwordResetExpires = undefined;
        await vendor.save();
        res.json({ success: true, message: "Password reset successfully." });
    } catch (err) {
        res.status(500).json({ success: false, message: "Password reset failed." });
    }
};

/* ═══════════════════════════════════════════════════
   DELIVERY FORGOT / RESET PASSWORD
═══════════════════════════════════════════════════ */
export const deliveryForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email?.trim()) return res.status(400).json({ success: false, message: "Email is required" });
        const SAFE = { success: true, message: "If this email is registered, a reset link has been sent." };

        const rider = await User.findOne({ email: sanitizeEmail(email), role: "delivery_boy" });
        if (!rider) return res.json(SAFE);

        const resetToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");
        rider.passwordResetToken = hashedToken;
        rider.passwordResetExpires = Date.now() + RESET_EXPIRY_MS;
        await rider.save({ validateBeforeSave: false });

        const resetUrl = `${process.env.DELIVERY_FRONTEND_URL || "https://delivery.partner.urbexon.in"}/reset-password/${resetToken}`;
        sendEmailBackground({ to: rider.email, subject: `${BRAND.name} Delivery — Password Reset`, html: buildDeliveryResetEmail(rider.name, resetUrl), label: "DeliveryAuth/ForgotPassword" });
        res.json(SAFE);
    } catch (err) {
        res.status(500).json({ success: false, message: "Something went wrong." });
    }
};

export const deliveryResetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;
        if (!token || !password?.trim())
            return res.status(400).json({ success: false, message: "Token and password required" });
        if (password.length < 8)
            return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });

        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
        const rider = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() },
            role: "delivery_boy",
        });
        if (!rider) return res.status(400).json({ success: false, message: "Reset link is invalid or has expired" });

        rider.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
        rider.passwordResetToken = undefined;
        rider.passwordResetExpires = undefined;
        await rider.save();
        res.json({ success: true, message: "Password reset successfully." });
    } catch (err) {
        res.status(500).json({ success: false, message: "Password reset failed." });
    }
};

/* ═══════════════════════════════════════════════════
   VENDOR OTP - SEND OTP (POST /api/vendor/send-otp)
═══════════════════════════════════════════════════ */
export const sendVendorOtp = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email?.trim()) return res.status(400).json({ success: false, message: "Email is required" });

        let user = await User.findOne({ email: sanitizeEmail(email) }).select("+emailOtp +emailOtpExpires +emailOtpAttempts");

        if (!user) {
            // Create placeholder vendor user
            user = await User.create({
                name: "Vendor Applicant",
                email: sanitizeEmail(email),
                role: "vendor",
                isEmailVerified: false,
            });
        } else if (user.role !== "vendor") {
            return res.status(400).json({ success: false, message: "Email linked to different role" });
        }

        const otp = generateOtp();
        user.emailOtp = otp;
        user.emailOtpExpires = Date.now() + OTP_EXPIRY_MS;
        user.emailOtpAttempts = 0;
        await user.save({ validateBeforeSave: false });

        sendEmailBackground(buildVendorOtpEmail(user.email, user.name, otp));
        res.json({ success: true, message: "OTP sent for vendor verification", email: user.email });

    } catch (err) {
        console.error("[sendVendorOtp]", err);
        res.status(500).json({ success: false, message: "OTP send failed" });
    }
};

/* ═══════════════════════════════════════════════════
   VENDOR OTP - VERIFY FOR REGISTER (POST /api/vendor/verify-otp-register)
═══════════════════════════════════════════════════ */
export const verifyVendorOtpRegister = async (req, res) => {
    try {
        const { email, otp, formData } = req.body; // formData = shop details JSON

        const user = await User.findOne({ email: sanitizeEmail(email), role: "vendor" })
            .select("+emailOtp +emailOtpExpires +emailOtpAttempts");

        if (!user) return res.status(404).json({ success: false, message: "Vendor session not found" });

        // OTP validation (reuse logic)
        if ((user.emailOtpAttempts || 0) >= MAX_OTP_ATTEMPTS || user.emailOtpExpires < Date.now() ||
            !crypto.timingSafeEqual(Buffer.from(user.emailOtp.toString()), Buffer.from(otp.toString()))) {
            user.emailOtpAttempts = (user.emailOtpAttempts || 0) + 1;
            await user.save();
            return res.status(400).json({ success: false, message: "Invalid OTP" });
        }

        // OTP OK → create vendor
        user.name = formData.ownerName || user.name;
        user.phone = formData.phone || user.phone;
        user.isEmailVerified = true;
        user.emailOtp = undefined;
        user.emailOtpExpires = undefined;
        user.emailOtpAttempts = 0;
        await user.save();

        // Call registerVendor logic (simulate req.body/files)
        const mockReq = { body: formData, user: { _id: user._id }, files: req.files };
        const vendorRes = await registerVendor(mockReq, res);
        if (vendorRes.success) {
            const token = generateToken(user._id, user.role);
            res.json({ success: true, token, user: safeUserPayload(user, token), vendor: vendorRes.vendor });
        } else {
            res.status(400).json(vendorRes);
        }

    } catch (err) {
        console.error("[verifyVendorOtpRegister]", err);
        res.status(500).json({ success: false, message: "Register failed" });
    }
};

/* ═══════════════════════════════════════════════════
   VENDOR OTP - LOGIN (POST /api/vendor/login-otp)
═══════════════════════════════════════════════════ */
export const vendorOtpLogin = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const user = await User.findOne({ email: sanitizeEmail(email), role: "vendor" })
            .select("+emailOtp +emailOtpExpires +emailOtpAttempts");

        if (!user) return res.status(401).json({ success: false, message: "Vendor not found" });

        // OTP check
        if ((user.emailOtpAttempts || 0) >= MAX_OTP_ATTEMPTS || user.emailOtpExpires < Date.now() ||
            !crypto.timingSafeEqual(Buffer.from(user.emailOtp.toString()), Buffer.from(otp.toString()))) {
            return res.status(400).json({ success: false, message: "Invalid OTP" });
        }

        user.emailOtp = undefined;
        user.emailOtpExpires = undefined;
        user.emailOtpAttempts = 0;
        await user.save();

        const token = generateToken(user._id, user.role);
        res.json({ success: true, token, user: safeUserPayload(user, token) });

    } catch (err) {
        console.error("[vendorOtpLogin]", err);
        res.status(500).json({ success: false, message: "Login failed" });
    }
};


/* ═══════════════════════════════════════════════════
   REFRESH TOKEN
═══════════════════════════════════════════════════ */
export const refreshToken = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer "))
            return res.status(401).json({ success: false, message: "Token missing" });

        const token = authHeader.split(" ")[1];
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET, { clockTolerance: 60 * 60 * 24 * 30 });
        } catch {
            return res.status(401).json({ success: false, message: "Token invalid or too old to refresh" });
        }

        const user = await User.findById(decoded.id).select("-password");
        if (!user) return res.status(401).json({ success: false, message: "User not found" });

        return res.json({ success: true, token: generateToken(user._id, user.role), _id: user._id, name: user.name, email: user.email, phone: user.phone || "", role: user.role });

    } catch (err) {
        console.error("[Auth] REFRESH ERROR:", err);
        return res.status(500).json({ success: false, message: "Refresh failed" });
    }
};

/* ═══════════════════════════════════════════════════
   ADMIN DASHBOARD
═══════════════════════════════════════════════════ */
export const adminGetDashboard = async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));

        const [
            totalOrders,
            totalRevenue,
            todayOrders,
            monthOrders,
            monthRevenue,
            activeProducts,
            totalUsers,
            pendingVendors,
            pendingRefunds,
            recentOrders,
        ] = await Promise.all([
            Order.countDocuments(),
            Order.aggregate([{ $group: { _id: null, total: { $sum: "$totalAmount" } } }]).then(r => r[0]?.total || 0),
            Order.countDocuments({ createdAt: { $gte: startOfToday } }),
            Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
            Order.aggregate([
                { $match: { createdAt: { $gte: startOfMonth } } },
                { $group: { _id: null, total: { $sum: "$totalAmount" } } },
            ]).then(r => r[0]?.total || 0),
            Product.countDocuments({ isActive: true }),
            User.countDocuments(),
            Vendor.countDocuments({ status: "pending" }),
            Order.countDocuments({ "refund.status": "REQUESTED" }),
            Order.find()
                .sort({ createdAt: -1 })
                .limit(10)
                .select("_id customerName orderStatus totalAmount createdAt")
                .lean(),
        ]);

        res.json({
            stats: {
                totalOrders,
                totalRevenue,
                todayOrders,
                monthOrders,
                monthRevenue,
                activeProducts,
                totalUsers,
                pendingVendors,
                pendingRefunds,
            },
            recentOrders,
        });
    } catch (err) {
        console.error("[adminGetDashboard]", err);
        res.status(500).json({ success: false, message: "Failed to fetch dashboard data" });
    }
};

/* ═══════════════════════════════════════════════════
   EMAIL BUILDERS (private)
═══════════════════════════════════════════════════ */
function buildOtpEmail(email, name, otp, role = "user") {
    const roleLabel = role === "vendor" ? "Vendor Account" : role === "delivery_boy" ? "Delivery Partner Account" : "Account";
    return {
        to: email,
        subject: `${otp} is your ${BRAND.name} verification code`,
        label: "Auth/OTP",
        html: `
<div style="font-family:'DM Sans',Arial,sans-serif;background:#f5f7fa;padding:32px 16px">
  <div style="max-width:520px;margin:auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
    <div style="background:#1a1740;padding:28px 32px;text-align:center">
      <p style="margin:0;font-size:22px;font-weight:800;color:#c9a84c;letter-spacing:3px;text-transform:uppercase">${BRAND.name}</p>
      <p style="margin:6px 0 0;font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:2px;text-transform:uppercase">${roleLabel} Verification</p>
    </div>
    <div style="padding:36px 32px;text-align:center">
      <p style="font-size:16px;font-weight:600;color:#111827;margin-bottom:8px">Hi ${name}! 👋</p>
      <p style="font-size:14px;color:#6b7280;margin-bottom:28px;line-height:1.6">Use this code to verify your ${BRAND.name} ${roleLabel}.<br/>Expires in <strong>10 minutes</strong>.</p>
      <div style="display:inline-block;background:#fffbeb;border:2px dashed #c9a84c;border-radius:12px;padding:20px 48px;margin-bottom:28px">
        <span style="font-size:40px;font-weight:900;color:#b8860b;letter-spacing:12px;font-family:monospace">${otp}</span>
      </div>
      <p style="font-size:12px;color:#9ca3af">Never share this OTP with anyone.</p>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #f3f4f6">
      <p style="font-size:11px;color:#d1d5db;margin:0">${BRAND.name} · ${BRAND.website} · ${BRAND.phone}</p>
    </div>
  </div>
</div>`,
    };
}

function buildResetEmail(name, resetUrl) {
    return `<div style="font-family:'DM Sans',Arial,sans-serif;background:#f5f7fa;padding:32px 16px"><div style="max-width:520px;margin:auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden"><div style="background:#1a1740;padding:28px 32px;text-align:center"><p style="margin:0;font-size:22px;font-weight:800;color:#c9a84c;letter-spacing:3px;text-transform:uppercase">${BRAND.name}</p><p style="margin:6px 0 0;font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:2px;text-transform:uppercase">Password Reset</p></div><div style="padding:36px 32px;text-align:center"><p style="font-size:16px;font-weight:600;color:#111827;margin-bottom:8px">Hi ${name}!</p><p style="font-size:14px;color:#6b7280;margin-bottom:28px;line-height:1.6">Click below to reset your password. Expires in <strong>15 minutes</strong>.</p><a href="${resetUrl}" style="display:inline-block;padding:14px 36px;background:#1a1740;color:#c9a84c;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px">Reset My Password →</a></div><div style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #f3f4f6"><p style="font-size:11px;color:#d1d5db;margin:0">${BRAND.name} · ${BRAND.website}</p></div></div></div>`;
}

function buildAdminResetEmail(name, resetUrl) {
    return `<div style="font-family:'DM Sans',Arial,sans-serif;background:#0f0e17;padding:40px 20px"><div style="max-width:480px;margin:auto;background:rgba(255,255,255,0.04);border:1px solid rgba(201,168,76,0.2);border-radius:16px;overflow:hidden"><div style="height:3px;background:linear-gradient(90deg,#c9a84c,#e8d080,#c9a84c)"></div><div style="padding:36px 32px;text-align:center"><p style="font-size:22px;font-weight:800;color:#c9a84c;letter-spacing:3px;text-transform:uppercase;margin-bottom:4px">${BRAND.name}</p><p style="font-size:14px;color:rgba(255,255,255,0.7);margin-bottom:28px;line-height:1.6">Hi <strong style="color:#fff">${name}</strong>, reset link expires in <strong>15 minutes</strong>.</p><a href="${resetUrl}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#c9a84c,#e8d080);color:#0f0e17;text-decoration:none;border-radius:8px;font-weight:800;font-size:14px">Reset Admin Password →</a></div></div></div>`;
}

function buildVendorResetEmail(name, resetUrl) {
    return `<div style="font-family:'DM Sans',Arial,sans-serif;background:#f5f7fa;padding:32px 16px"><div style="max-width:520px;margin:auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden"><div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:28px 32px;text-align:center"><p style="margin:0;font-size:22px;font-weight:800;color:#fff;letter-spacing:3px;text-transform:uppercase">${BRAND.name}</p><p style="margin:6px 0 0;font-size:11px;color:rgba(255,255,255,0.6);letter-spacing:2px;text-transform:uppercase">Vendor Password Reset</p></div><div style="padding:36px 32px;text-align:center"><p style="font-size:16px;font-weight:600;color:#111827;margin-bottom:8px">Hi ${name}!</p><p style="font-size:14px;color:#6b7280;margin-bottom:28px;line-height:1.6">Click below to reset your vendor account password. Expires in <strong>15 minutes</strong>.</p><a href="${resetUrl}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px">Reset Vendor Password →</a></div><div style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #f3f4f6"><p style="font-size:11px;color:#d1d5db;margin:0">${BRAND.name} · ${BRAND.website}</p></div></div></div>`;
}

function buildDeliveryResetEmail(name, resetUrl) {
    return `<div style="font-family:'DM Sans',Arial,sans-serif;background:#f5f7fa;padding:32px 16px"><div style="max-width:520px;margin:auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden"><div style="background:linear-gradient(135deg,#0f172a,#134e2a);padding:28px 32px;text-align:center"><p style="margin:0;font-size:22px;font-weight:800;color:#22c55e;letter-spacing:3px;text-transform:uppercase">${BRAND.name}</p><p style="margin:6px 0 0;font-size:11px;color:rgba(255,255,255,0.6);letter-spacing:2px;text-transform:uppercase">Delivery Partner Password Reset</p></div><div style="padding:36px 32px;text-align:center"><p style="font-size:16px;font-weight:600;color:#111827;margin-bottom:8px">Hi ${name}!</p><p style="font-size:14px;color:#6b7280;margin-bottom:28px;line-height:1.6">Click below to reset your delivery partner password. Expires in <strong>15 minutes</strong>.</p><a href="${resetUrl}" style="display:inline-block;padding:14px 36px;background:#0f172a;color:#22c55e;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px">Reset Password →</a></div><div style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #f3f4f6"><p style="font-size:11px;color:#d1d5db;margin:0">${BRAND.name} · ${BRAND.website}</p></div></div></div>`;
}