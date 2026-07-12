import asyncHandler from "../utils/asyncHandler.js";
import User from "../models/User.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Vendor from "../models/vendorModels/Vendor.js";
import DeliveryBoy from "../models/deliveryModels/DeliveryBoy.js";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendEmailBackground } from "../utils/emailService.js";

/* ─────────────────────────────────────────────
    Constants
───────────────────────────────────────────── */
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const RESET_EXPIRY_MS = 15 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const BCRYPT_ROUNDS = 10;
// BUG FIX: was 15m. With `protect` now actually enforcing tokenVersion
// (see authMiddleware.js), logout-all-devices/password-change/block all
// take effect immediately regardless of how long an access token has left
// to live — so there's no longer a security reason to keep this window
// short. 15m meant every tab, on every reload, had a good chance of
// starting with an already-expired token, leaning entirely on the
// refresh-token round trip (and every edge case in it — cookie path,
// CORS, clock skew) just to load a page. 1h gives real headroom while
// the 30-day refresh token cookie still re-issues it long before then.
const JWT_EXPIRY = "1h";
// BUG FIX: was 7 days — any user (customer, vendor, delivery, or admin;
// this refresh mechanism is shared via authenticateByRole/issueTokens for
// all roles) whose refresh-token cookie outlived 7 days without a fresh
// login got hard logged out, regardless of how recently they'd actually
// been using the app. Session should persist at least 30 days while active.
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

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
const generateToken = (user) =>
    jwt.sign({ id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRY });

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

/* ─────────────────────────────────────────────
    Refresh sessions — per-panel scoped cookies
─────────────────────────────────────────────
All four apps (client / vendor / admin / delivery) share this API origin,
so a single "refreshToken" cookie meant each panel's login OVERWROTE the
others' session in the same browser: when panel A's access token expired,
/auth/refresh matched the cookie of whichever account logged in LAST and
handed panel A a token for the wrong user/role — every role-guarded call
then 401/403'd and the panel force-logged-out. Each panel now gets its own
cookie (rt_client / rt_vendor / rt_admin / rt_delivery) and declares its
scope when refreshing.

Sessions are stored as an ARRAY on the user (see User.refreshSessions):
the old single refreshToken field meant a login on any second device or
panel invalidated the first one's session, and two tabs refreshing at the
same moment raced each other into a forced logout (first tab rotated the
DB token, second tab's cookie no longer matched). Refresh now uses a
SLIDING expiry on the matched session instead of rotating the token, so
concurrent tabs can never invalidate each other; tokens rotate only on
fresh logins. */
const AUTH_SCOPES = ["client", "vendor", "admin", "delivery"];
const MAX_SESSIONS_PER_USER = 10;
const scopeCookieName = (scope) => `rt_${scope}`;

// Cookie path covers /api/auth/refresh AND /api/auth/logout. The old path
// ("/api/auth/refresh") meant the logout endpoint never received the cookie,
// so server-side revocation on logout silently never worked.
const REFRESH_COOKIE_OPTIONS = (expires) => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
    expires,
    path: "/api/auth",
});

const CLEAR_COOKIE_OPTIONS = (path = "/api/auth") => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
    path,
});

const roleToScope = (role) =>
    role === "vendor" ? "vendor"
        : role === "delivery_boy" ? "delivery"
            : ["admin", "owner"].includes(role) ? "admin"
                : "client";

const issueTokens = async (res, user, scope, req = null) => {
    const validScope = AUTH_SCOPES.includes(scope) ? scope : roleToScope(user.role);
    const accessToken = generateToken(user);
    const refreshToken = crypto.randomBytes(64).toString("hex");
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    // Sessions may not be loaded on this document (select: false) — fetch
    // current ones so we append instead of clobbering other devices/panels.
    const withSessions = await User.findById(user._id).select("+refreshSessions").lean();
    const now = Date.now();
    const sessions = (withSessions?.refreshSessions || [])
        .filter(s => s.expiresAt && new Date(s.expiresAt).getTime() > now);

    sessions.push({
        token: refreshToken,
        scope: validScope,
        expiresAt,
        createdAt: new Date(),
        ip: req ? getClientIp(req) : undefined,
        device: req ? getDeviceLabel(req) : undefined,
    });

    // Cap sessions per user (drop oldest first) so a user can't grow an
    // unbounded list of live refresh tokens.
    while (sessions.length > MAX_SESSIONS_PER_USER) sessions.shift();

    user.refreshSessions = sessions;
    // Stop writing the legacy single-token fields; clear them so old and new
    // mechanisms can't disagree about which token is live.
    user.refreshToken = undefined;
    user.refreshTokenExpires = undefined;
    await user.save({ validateBeforeSave: false });

    res.cookie(scopeCookieName(validScope), refreshToken, REFRESH_COOKIE_OPTIONS(expiresAt));

    return accessToken;
};

const sanitizeEmail = (e) => e?.toLowerCase().trim();
const sanitizeName = (n) => n?.trim().slice(0, 100);

const safeUserPayload = (user) => ({
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
});

const getClientIp = (req) =>
    (req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress || "").trim();

const getDeviceLabel = (req) => (req.headers["user-agent"] || "Unknown device").slice(0, 200);

const buildIdentifierQuery = (identifier) => {
    const isEmail = identifier.includes("@");
    return isEmail ? { email: sanitizeEmail(identifier) } : { phone: identifier.trim() };
};

/* ─────────────────────────────────────────────
    Email Builders
───────────────────────────────────────────── */
const buildOtpEmail = (email, name, otp, role = 'user') => {
    const subject = `Your OTP for ${BRAND.name} is ${otp}`;
    const intro = role === 'vendor' || role === 'delivery_boy'
        ? `Welcome to ${BRAND.name}! Please use the OTP below to verify your email and complete your registration.`
        : `Please use the OTP below to verify your email for ${BRAND.name}.`;

    const html = `
        <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="text-align: center; color: #333;">Email Verification</h2>
            <p>Hi ${name},</p>
            <p>${intro}</p>
            <p style="text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                ${otp}
            </p>
            <p>This OTP is valid for 10 minutes. If you did not request this, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee;" />
            <p style="font-size: 12px; color: #888;">Thanks,<br/>The ${BRAND.name} Team</p>
        </div>
    `;
    return { to: email, subject, html, label: "Auth/OTP" };
};

const buildResetEmail = (name, resetUrl) => `
    <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>Hi ${name},</p>
        <p>We received a request to reset your password. Click the button below to set a new password:</p>
        <div style="text-align: center; margin: 20px 0;">
            <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
        </div>
        <p>This link is valid for 15 minutes. If you did not request a password reset, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #888;">Thanks,<br/>The ${BRAND.name} Team</p>
    </div>
`;

const buildAdminResetEmail = (name, resetUrl) => `
    <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
        <h2 style="color: #333;">Admin Password Reset</h2>
        <p>Hi ${name},</p>
        <p>A password reset was requested for your ${BRAND.name} Admin account. Click the button below to reset it:</p>
        <div style="text-align: center; margin: 20px 0;">
            <a href="${resetUrl}" style="background-color: #dc3545; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Admin Password</a>
        </div>
        <p>This link is valid for 15 minutes. If you did not request this, please ignore this email.</p>
    </div>
`;

const buildVendorResetEmail = (name, resetUrl) => `
    <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
        <h2 style="color: #333;">Vendor Password Reset</h2>
        <p>Hi ${name},</p>
        <p>A password reset was requested for your ${BRAND.name} Vendor account. Click the button below to reset it:</p>
        <div style="text-align: center; margin: 20px 0;">
            <a href="${resetUrl}" style="background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Vendor Password</a>
        </div>
        <p>This link is valid for 15 minutes. If you did not request this, please ignore this email.</p>
    </div>
`;

const buildDeliveryResetEmail = (name, resetUrl) => `
    <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
        <h2 style="color: #333;">Delivery Partner Password Reset</h2>
        <p>Hi ${name},</p>
        <p>A password reset was requested for your ${BRAND.name} Delivery Partner account. Click the button below to reset it:</p>
        <div style="text-align: center; margin: 20px 0;">
            <a href="${resetUrl}" style="background-color: #ffc107; color: black; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Partner Password</a>
        </div>
        <p>This link is valid for 15 minutes. If you did not request this, please ignore this email.</p>
    </div>
`;

/**
 * Shared login core, reused by login / vendorLogin / deliveryLogin / adminLogin.
 *
 * ✅ FIX (v2): Vendor/delivery approval status no longer BLOCKS login.
 * Previously, a user who registered but hadn't completed (or wasn't yet
 * approved for) their vendor/delivery application could never log in —
 * which meant they could never reach the in-app "Apply"/"Complete application"
 * screen, since that screen requires an authenticated session. This created
 * an unrecoverable chicken-and-egg trap and meant the admin panel never saw
 * any application data for such accounts.
 *
 * Now: login always succeeds (token issued) for a valid, verified, non-blocked
 * account. The applicationStatus is returned in the response instead, and the
 * frontend is responsible for routing the user to the application form or a
 * "pending approval" screen as appropriate.
 */
// NOTE: plain async helper (NOT asyncHandler-wrapped). It's invoked by the
// exported login handlers below with an options object in the 3rd arg — if
// it were asyncHandler-wrapped, that object would land in asyncHandler's
// `next` slot and `.catch(next)` would call a non-function on any throw,
// leaving the rejection unhandled and crashing the process. The exported
// handlers are each wrapped in asyncHandler instead, so rejections here
// propagate correctly to Express's error middleware.
const authenticateByRole = async (req, res, { roleFilter, deniedMessage, allowAdminRoles = false, scope }) => {
    const { email, phone, password } = req.body;

    // SECURITY: credentials must be strings. A NoSQL-injection probe like
    // { "email": { "$gt": "" }, "password": { "$gt": "" } } used to reach
    // `password.trim()` and throw "trim is not a function" — which, combined
    // with the asyncHandler misuse above, crashed the whole server (remote
    // DoS) and also fed an operator object straight into the Mongo query.
    if (typeof password !== "string" ||
        (typeof email !== "string" && typeof phone !== "string")) {
        return res.status(400).json({ success: false, message: "Email/phone and password are required" });
    }

    const identifier = (email || phone || "").trim();

    if (!identifier || !password.trim())
        return res.status(400).json({ success: false, message: "Email/phone and password are required" });

    const user = await User.findOne(buildIdentifierQuery(identifier))
        .select("+password +emailOtp +emailOtpExpires +emailOtpAttempts +loginAttempts +tokenVersion");

    if (!user) return res.status(401).json({ success: false, message: "Invalid credentials" });

    if (user.isDeleted)
        return res.status(401).json({ success: false, message: "Invalid credentials" });

    if (user.isBlocked)
        return res.status(403).json({ success: false, message: "Your account has been blocked. Please contact support." });

    if (roleFilter && !roleFilter.includes(user.role)) {
        return res.status(403).json({ success: false, message: deniedMessage });
    }
    if (!roleFilter && !allowAdminRoles && ["admin", "owner"].includes(user.role)) {
        return res.status(403).json({ success: false, message: "Admin accounts must login via the Admin Panel." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // ✅ FIX: Approval status is now informational only — it does NOT block login.
    // 'not_applied' | 'pending' | 'approved' | 'rejected'
    let vendorApplicationStatus = null;
    let deliveryApplicationStatus = null;

    if (roleFilter && roleFilter.includes('vendor')) {
        const vendor = await Vendor.findOne({ userId: user._id }).lean();
        vendorApplicationStatus = vendor?.status || 'not_applied';
    }
    if (roleFilter && roleFilter.includes('delivery_boy')) {
        const deliveryBoy = await DeliveryBoy.findOne({ userId: user._id }).lean();
        deliveryApplicationStatus = deliveryBoy?.status || 'not_applied';
    }

    if (!user.isEmailVerified) {
        const otp = generateOtp();
        user.emailOtp = otp;
        user.emailOtpExpires = Date.now() + OTP_EXPIRY_MS;
        user.emailOtpAttempts = 0;
        await user.save({ validateBeforeSave: false });
        sendEmailBackground(buildOtpEmail(user.email, user.name, otp));
        return res.status(403).json({ success: false, message: "Please verify your email first. OTP sent.", requiresVerification: true, email: user.email });
    }

    // ✅ FIX: Replaced missing `registerSuccessfulLogin` method with its direct implementation.
    // This resolves the "is not a function" TypeError during login.
    user.lastLoginAt = new Date();
    user.loginAttempts = 0; // Reset login attempts on success
    if (!user.loginHistory) user.loginHistory = [];
    user.loginHistory.unshift({
        ip: getClientIp(req),
        device: getDeviceLabel(req),
        loggedInAt: new Date(),
    });
    // Keep login history to a reasonable size
    if (user.loginHistory.length > 10) {
        user.loginHistory.splice(10);
    }
    await user.save({ validateBeforeSave: false });

    const accessToken = await issueTokens(res, user, scope, req);
    return res.status(200).json({
        success: true,
        token: accessToken,
        user: safeUserPayload(user),
        ...(vendorApplicationStatus !== null && { vendorApplicationStatus }),
        ...(deliveryApplicationStatus !== null && { deliveryApplicationStatus }),
    });
};

/* ═══════════════════════════════════════════════════
    REGISTER
═══════════════════════════════════════════════════ */
export const register = asyncHandler(async (req, res) => {
    const { name, email, phone, password, role } = req.body;

    if (!name?.trim() || !email?.trim() || !phone?.trim() || !password?.trim())
        return res.status(400).json({ success: false, message: "All fields are required" });

    if (!/^[6-9]\d{9}$/.test(phone.trim()))
        return res.status(400).json({ success: false, message: "Enter a valid 10-digit Indian mobile number" });

    if (password.length < 8)
        return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });

    // Directly assign the role requested by the user, ensuring it's a valid public role.
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

    sendEmailBackground(buildOtpEmail(user.email, user.name, otp, role));

    return res.status(201).json({
        success: true,
        message: (role === 'vendor' || role === 'delivery_boy')
            ? "Account created! Please verify your email with the OTP sent, then you can complete your vendor application."
            : "OTP sent to your email. Please verify to continue.",
        email: user.email,
        role: assignedRole,
        requiresVerification: true,
    });
});

/* ═══════════════════════════════════════════════════
    VERIFY OTP
═══════════════════════════════════════════════════ */
export const verifyOtp = asyncHandler(async (req, res) => {
    const { email, phone, otp } = req.body;
    const identifier = email || phone;

    if (!identifier?.trim() || !otp?.trim())
        return res.status(400).json({ success: false, message: "Email/phone and OTP are required" });

    const user = await User.findOne(buildIdentifierQuery(identifier))
        .select("+emailOtp +emailOtpExpires +emailOtpAttempts +tokenVersion");

    if (!user)
        return res.status(404).json({ success: false, message: "No account found with this identifier" });

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

    const submittedOtp = otp.trim().toString();
    let otpValid = false;
    if (submittedOtp.length === user.emailOtp.length) {
        otpValid = crypto.timingSafeEqual(Buffer.from(user.emailOtp), Buffer.from(submittedOtp));
    }

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

    // ✅ FIX: Mark email as verified upon successful OTP entry.
    // This was the critical bug causing users to get stuck in an OTP loop on subsequent logins.
    user.emailOtp = undefined; user.emailOtpExpires = undefined; user.emailOtpAttempts = 0;
    user.isEmailVerified = true;
    await user.save({ validateBeforeSave: false }); // Use false to avoid re-validating fields not being changed

    const accessToken = await issueTokens(res, user, null, req);

    // ✅ FIX: Also return applicationStatus right after OTP verification so the
    // delivery/vendor panel frontend can route a freshly-verified user straight
    // to the application form instead of bouncing through login first.
    let vendorApplicationStatus = null;
    let deliveryApplicationStatus = null;
    if (user.role === 'vendor') {
        const vendor = await Vendor.findOne({ userId: user._id }).lean();
        vendorApplicationStatus = vendor?.status || 'not_applied';
    }
    if (user.role === 'delivery_boy') {
        const deliveryBoy = await DeliveryBoy.findOne({ userId: user._id }).lean();
        deliveryApplicationStatus = deliveryBoy?.status || 'not_applied';
    }

    const payload = {
        success: true,
        token: accessToken,
        user: safeUserPayload(user),
        ...(vendorApplicationStatus !== null && { vendorApplicationStatus }),
        ...(deliveryApplicationStatus !== null && { deliveryApplicationStatus }),
    };

    return res.status(200).json(payload);
});

/* ═══════════════════════════════════════════════════
    RESEND OTP
═══════════════════════════════════════════════════ */
export const resendOtp = asyncHandler(async (req, res) => {
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
});

/* ═══════════════════════════════════════════════════
    LOGIN
═══════════════════════════════════════════════════ */
export const login = asyncHandler((req, res) =>
    authenticateByRole(req, res, { roleFilter: null, deniedMessage: null, scope: "client" }));

export const vendorLogin = asyncHandler((req, res) =>
    authenticateByRole(req, res, { roleFilter: ["vendor"], deniedMessage: "Access denied. This is not a vendor account.", scope: "vendor" }));

export const deliveryLogin = asyncHandler((req, res) =>
    authenticateByRole(req, res, { roleFilter: ["delivery_boy"], deniedMessage: "Access denied. This is not a delivery partner account.", scope: "delivery" }));

export const adminLogin = asyncHandler((req, res) =>
    authenticateByRole(req, res, { roleFilter: ["admin", "owner"], deniedMessage: "Access denied. Not an admin account.", allowAdminRoles: true, scope: "admin" }));

/* ═══════════════════════════════════════════════════
    LOGOUT ALL DEVICES
═══════════════════════════════════════════════════ */
export const logoutAllDevices = asyncHandler(async (req, res) => {
    // Bump tokenVersion (kills all live access tokens via protect middleware)
    // AND drop every refresh session so no device can mint a new one.
    await User.findByIdAndUpdate(req.user._id, {
        $inc: { tokenVersion: 1 },
        $unset: { refreshSessions: 1, refreshToken: 1, refreshTokenExpires: 1 },
    });
    return res.json({ success: true, message: "Logged out from all devices." });
});

/* ═══════════════════════════════════════════════════
    PROFILE
═══════════════════════════════════════════════════ */
export const getProfile = asyncHandler(async (req, res) => {
    const user = req.user;
    res.json({
        success: true, _id: user._id, name: user.name, email: user.email,
        phone: user.phone || "", role: user.role, addresses: user.addresses,
        location: user.location, createdAt: user.createdAt,
    });
});

export const updateProfile = asyncHandler(async (req, res) => {
    const { name, phone } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: "Name is required" });
    if (phone && !/^[6-9]\d{9}$/.test(phone.trim()))
        return res.status(400).json({ success: false, message: "Enter a valid 10-digit Indian mobile number" });

    const update = { name: sanitizeName(name) };
    if (phone !== undefined) update.phone = phone.trim();

    const user = await User.findByIdAndUpdate(req.user._id, { $set: update }, { new: true, runValidators: true })
        .select("name email phone role");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    res.json({ success: true, _id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role });
});

/* ═══════════════════════════════════════════════════
    CHANGE PASSWORD
═══════════════════════════════════════════════════ */
export const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
        return res.status(400).json({ success: false, message: "Both passwords required" });
    if (newPassword.length < 8)
        return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
    if (currentPassword === newPassword)
        return res.status(400).json({ success: false, message: "New password must be different" });

    const user = await User.findById(req.user._id).select("+password +tokenVersion");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: "Current password is incorrect" });

    user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    // Kill refresh sessions too — tokenVersion only invalidates ACCESS tokens;
    // without this, an old device could still mint fresh ones via refresh.
    user.refreshSessions = undefined;
    user.refreshToken = undefined;
    user.refreshTokenExpires = undefined;
    await user.save();
    res.json({ success: true, message: "Password changed successfully. Please login again on other devices." });
});

/* ═══════════════════════════════════════════════════
    SAVE LOCATION
═══════════════════════════════════════════════════ */
export const saveLocation = asyncHandler(async (req, res) => {
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
});

/* ═══════════════════════════════════════════════════
    GOOGLE LOGIN / SIGNUP (Firebase ID Token)
═══════════════════════════════════════════════════ */
export const googleLogin = asyncHandler(async (req, res) => {
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

    const { email, name, uid } = decoded;
    if (!email) return res.status(400).json({ success: false, message: "Google account has no email" });

    let user = await User.findOne({ email: sanitizeEmail(email) }).select("+tokenVersion");

    if (user) {
        if (["admin", "owner"].includes(user.role))
            return res.status(403).json({ success: false, message: "Admin accounts must login via the Admin Panel." });

        if (user.isDeleted)
            return res.status(401).json({ success: false, message: "Invalid credentials" });

        if (!user.googleId) {
            user.googleId = uid;
            user.isEmailVerified = true;
            await user.save({ validateBeforeSave: false });
        }

        // ✅ FIX: Replaced missing `registerSuccessfulLogin` method with its direct implementation.
        // This resolves the "is not a function" TypeError during login.
        user.lastLoginAt = new Date();
        user.loginAttempts = 0; // Reset login attempts on success
        if (!user.loginHistory) user.loginHistory = [];
        user.loginHistory.unshift({
            ip: getClientIp(req),
            device: getDeviceLabel(req),
            loggedInAt: new Date(),
        });
        // Keep login history to a reasonable size
        if (user.loginHistory.length > 10) {
            user.loginHistory.splice(10);
        }
        await user.save({ validateBeforeSave: false });
        const accessToken = await issueTokens(res, user, null, req);
        return res.json({ success: true, token: accessToken, user: safeUserPayload(user) });
    }

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

    const accessToken = await issueTokens(res, user, null, req);
    return res.status(201).json({ success: true, token: accessToken, user: safeUserPayload(user) });
});

/* ═══════════════════════════════════════════════════
    GET ALL USERS (ADMIN)
═══════════════════════════════════════════════════ */
export const getAllUsers = asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const filter = { isDeleted: { $ne: true } };
    if (req.query.search?.trim()) {
        const esc = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
});

/* ═══════════════════════════════════════════════════
    TOGGLE BLOCK USER (ADMIN)
═══════════════════════════════════════════════════ */
export const toggleBlockUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).select("+tokenVersion");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (user.role === "admin" || user.role === "owner")
        return res.status(403).json({ success: false, message: "Cannot block admin/owner accounts" });

    user.isBlocked = !user.isBlocked;
    user.blockedAt = user.isBlocked ? new Date() : null;
    if (user.isBlocked) {
        user.tokenVersion = (user.tokenVersion || 0) + 1;
        // Blocked users are already rejected by /refresh, but drop the
        // sessions anyway so unblocking doesn't silently revive them.
        user.refreshSessions = undefined;
        user.refreshToken = undefined;
        user.refreshTokenExpires = undefined;
    }
    await user.save({ validateBeforeSave: false });

    res.json({ success: true, message: `User ${user.isBlocked ? "blocked" : "unblocked"} successfully`, isBlocked: user.isBlocked });
});

/* ═══════════════════════════════════════════════════
    FORGOT / RESET PASSWORD HELPERS
═══════════════════════════════════════════════════ */
async function handleForgotPassword({ roleFilter, frontendUrlEnv, defaultFrontendUrl, emailBuilder, subject, label }, req, res) {
    const { email } = req.body;
    if (!email?.trim()) return res.status(400).json({ success: false, message: "Email is required" });
    const SAFE = { success: true, message: "If this email is registered, a reset link has been sent." };

    const query = { email: sanitizeEmail(email) };
    if (roleFilter) query.role = roleFilter;
    const user = await User.findOne(query);
    if (!user) return res.json(SAFE);

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = Date.now() + RESET_EXPIRY_MS;
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env[frontendUrlEnv] || defaultFrontendUrl}/reset-password/${resetToken}`;
    sendEmailBackground({ to: user.email, subject, html: emailBuilder(user.name, resetUrl), label });
    return res.json(SAFE);
}

async function handleResetPassword({ roleFilter }, req, res) {
    const { token } = req.params;
    const { password } = req.body;
    if (!token || !password?.trim())
        return res.status(400).json({ success: false, message: "Token and new password required" });
    if (password.length < 8)
        return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const query = { passwordResetToken: hashedToken, passwordResetExpires: { $gt: Date.now() } };
    if (roleFilter) query.role = roleFilter;

    const user = await User.findOne(query).select("+tokenVersion");
    if (!user) return res.status(400).json({ success: false, message: "Reset link is invalid or has expired" });

    user.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    // Also revoke all refresh sessions — a password reset must terminate
    // every existing session, not just expire the short-lived access tokens.
    user.refreshSessions = undefined;
    user.refreshToken = undefined;
    user.refreshTokenExpires = undefined;
    await user.save();
    return res.json({ success: true, message: "Password reset successfully." });
}

export const forgotPassword = asyncHandler(async (req, res) => {
    handleForgotPassword({
        roleFilter: null,
        frontendUrlEnv: "CLIENT_URL", defaultFrontendUrl: process.env.CLIENT_URL || "https://urbexon.in",
        emailBuilder: buildResetEmail, subject: `Reset Your Password — ${BRAND.name}`, label: "Auth/ForgotPassword",
    }, req, res);
});

export const resetPassword = asyncHandler(async (req, res) => {
    handleResetPassword({ roleFilter: null }, req, res);
});

export const adminForgotPassword = asyncHandler(async (req, res) => {
    handleForgotPassword({
        roleFilter: { $in: ["admin", "owner"] },
        frontendUrlEnv: "ADMIN_URL", defaultFrontendUrl: process.env.ADMIN_URL || "https://admin.urbexon.in",
        emailBuilder: buildAdminResetEmail, subject: `${BRAND.name} Admin — Password Reset`, label: "AdminAuth/ForgotPassword",
    }, req, res);
});

export const adminResetPassword = asyncHandler(async (req, res) => {
    handleResetPassword({ roleFilter: { $in: ["admin", "owner"] } }, req, res);
});

export const vendorForgotPassword = asyncHandler(async (req, res) => {
    handleForgotPassword({
        roleFilter: "vendor",
        frontendUrlEnv: "VENDOR_URL", defaultFrontendUrl: process.env.VENDOR_URL || "https://vendor.urbexon.in",
        emailBuilder: buildVendorResetEmail, subject: `${BRAND.name} Vendor — Password Reset`, label: "VendorAuth/ForgotPassword",
    }, req, res);
});

export const vendorResetPassword = asyncHandler(async (req, res) => {
    handleResetPassword({ roleFilter: "vendor" }, req, res);
});

export const deliveryForgotPassword = asyncHandler(async (req, res) => {
    handleForgotPassword({
        roleFilter: "delivery_boy",
        frontendUrlEnv: "DELIVERY_URL", defaultFrontendUrl: process.env.DELIVERY_URL || "https://delivery.partner.urbexon.in",
        emailBuilder: buildDeliveryResetEmail, subject: `${BRAND.name} Delivery — Password Reset`, label: "DeliveryAuth/ForgotPassword",
    }, req, res);
});

export const deliveryResetPassword = asyncHandler(async (req, res) => {
    handleResetPassword({ roleFilter: "delivery_boy" }, req, res);
});

/* ═══════════════════════════════════════════════════
    LOGOUT
═══════════════════════════════════════════════════ */
export const logout = asyncHandler(async (req, res) => {
    // Revoke only the requesting panel's session (scope in body). Without a
    // scope, revoke every session cookie this request carries — logging out
    // of one panel must never kill a DIFFERENT panel's session unless we
    // can't tell them apart.
    const scope = AUTH_SCOPES.includes(req.body?.scope) ? req.body.scope : null;
    const scopesToClear = scope ? [scope] : AUTH_SCOPES;

    for (const s of scopesToClear) {
        const token = req.cookies?.[scopeCookieName(s)];
        if (token) {
            await User.updateOne(
                { "refreshSessions.token": token },
                { $pull: { refreshSessions: { token } } }
            );
        }
        res.clearCookie(scopeCookieName(s), CLEAR_COOKIE_OPTIONS());
    }

    // Legacy cookie (pre-scoped deploys) — revoke and clear it too.
    const legacyToken = req.cookies?.refreshToken;
    if (legacyToken) {
        await User.updateOne(
            { refreshToken: legacyToken },
            { $unset: { refreshToken: 1, refreshTokenExpires: 1 } }
        );
    }
    res.clearCookie("refreshToken", CLEAR_COOKIE_OPTIONS("/api/auth/refresh"));

    res.json({ success: true, message: "Logged out successfully" });
});

/* ═══════════════════════════════════════════════════
    REFRESH TOKEN
═══════════════════════════════════════════════════ */
export const refreshToken = asyncHandler(async (req, res) => {
    // Each panel declares which session it's refreshing (scope in body →
    // scoped cookie). Legacy "refreshToken" cookie still accepted so
    // sessions issued before this deploy keep working until they rotate.
    const scope = AUTH_SCOPES.includes(req.body?.scope) ? req.body.scope : null;

    let token = null;
    let tokenIsLegacy = false;

    if (scope && req.cookies?.[scopeCookieName(scope)]) {
        token = req.cookies[scopeCookieName(scope)];
    } else if (req.cookies?.refreshToken) {
        token = req.cookies.refreshToken;
        tokenIsLegacy = true;
    } else if (!scope) {
        // No scope declared and no legacy cookie — if exactly one scoped
        // cookie is present, use it (old frontend build talking to new API).
        const present = AUTH_SCOPES.filter(s => req.cookies?.[scopeCookieName(s)]);
        if (present.length === 1) token = req.cookies[scopeCookieName(present[0])];
    }

    if (!token) {
        return res.status(401).json({ success: false, message: "Refresh token not found" });
    }

    const now = new Date();

    // Primary lookup: session array. Fallback: legacy single-token fields.
    let user = await User.findOne({
        refreshSessions: { $elemMatch: { token, expiresAt: { $gt: now } } },
    }).select("+tokenVersion +refreshSessions");

    let legacyMatch = false;
    if (!user) {
        user = await User.findOne({
            refreshToken: token,
            refreshTokenExpires: { $gt: now },
        }).select("+tokenVersion +refreshSessions");
        legacyMatch = !!user;
    }

    if (!user) {
        return res.status(403).json({ success: false, message: "Invalid or expired refresh token" });
    }

    if (user.isDeleted || user.isBlocked) {
        return res.status(403).json({ success: false, message: "Account is not eligible to refresh session." });
    }

    const sessionScope = scope || roleToScope(user.role);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    if (legacyMatch) {
        // Migrate the legacy single token into a session entry (same token,
        // so other tabs still holding the legacy cookie keep working).
        const sessions = (user.refreshSessions || []).filter(s => s.expiresAt > now);
        sessions.push({ token, scope: sessionScope, expiresAt, createdAt: new Date(), ip: getClientIp(req), device: getDeviceLabel(req) });
        user.refreshSessions = sessions;
        user.refreshToken = undefined;
        user.refreshTokenExpires = undefined;
        await user.save({ validateBeforeSave: false });
    } else {
        // Sliding expiry on the matched session. Deliberately NOT rotating
        // the token here: rotation on refresh is what let two concurrent
        // tabs invalidate each other (first tab rotates, second tab's cookie
        // no longer matches → 403 → forced logout). Tokens rotate on login.
        await User.updateOne(
            { _id: user._id, "refreshSessions.token": token },
            { $set: { "refreshSessions.$.expiresAt": expiresAt } }
        );
    }

    // Re-set the scoped cookie with the extended expiry (also migrates a
    // legacy-cookie session onto its scoped cookie name).
    res.cookie(scopeCookieName(sessionScope), token, REFRESH_COOKIE_OPTIONS(expiresAt));
    if (tokenIsLegacy) {
        res.clearCookie("refreshToken", CLEAR_COOKIE_OPTIONS("/api/auth/refresh"));
    }

    const accessToken = generateToken(user);
    return res.json({ success: true, token: accessToken, user: safeUserPayload(user) });
});

/* ═══════════════════════════════════════════════════
    ADMIN DASHBOARD
═══════════════════════════════════════════════════ */
export const adminGetDashboard = asyncHandler(async (req, res) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));

    const [
        totalOrders, totalRevenue, todayOrders, monthOrders, monthRevenue,
        activeProducts, totalUsers, pendingVendors, pendingRefunds, recentOrders,
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
        User.countDocuments({ isDeleted: { $ne: true } }),
        Vendor.countDocuments({ status: "pending" }),
        Order.countDocuments({ "refund.status": "REQUESTED" }),
        Order.find().sort({ createdAt: -1 }).limit(10)
            .select("_id customerName orderStatus totalAmount createdAt").lean(),
    ]);

    res.json({
        totalOrders, totalRevenue, todayOrders, monthOrders, monthRevenue, activeProducts, totalUsers, pendingVendors, pendingRefunds, recentOrders
    });
});