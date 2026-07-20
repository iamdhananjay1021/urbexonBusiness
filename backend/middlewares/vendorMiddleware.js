/**
 * vendorMiddleware.js — Production v2.1
 *
 * FIXES:
 * - protectVendor: sets req.vendor = full Vendor doc, req.user = {_id: userId}
 * - requireApprovedVendor: checks vendor status === "approved"
 * - requireActiveSubscription: checks Subscription collection (status=active + not expired)
 * - requireApprovedAndSubscribed: COMBINED guard for routes needing both
 */
import jwt from "jsonwebtoken";
import Vendor from "../models/vendorModels/Vendor.js";
import Subscription from "../models/vendorModels/Subscription.js";

export const protectVendor = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization?.startsWith("Bearer ")) {
            token = req.headers.authorization.split(" ")[1];
        } else if (req.cookies?.token) {
            token = req.cookies.token;
        }

        if (!token) return res.status(401).json({ success: false, message: "Not authorized. Please login." });

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            if (err.name === "TokenExpiredError")
                return res.status(401).json({ success: false, message: "Session expired. Please login again." });
            return res.status(401).json({ success: false, message: "Invalid token." });
        }

        const userId = decoded.id || decoded._id;

        const vendor = await Vendor.findOne({ userId, isDeleted: false });
        if (!vendor)
            return res.status(404).json({ success: false, message: "Vendor profile not found. Please apply first." });

        req.vendor = vendor;
        // role added so shared middleware that reads req.user.role (e.g.
        // adminSecurityMiddleware.js's auditLog) works identically whether
        // it runs after protect (full User doc) or protectVendor (this
        // partial stand-in) — req.user otherwise stays intentionally
        // minimal, see the doc-comment above.
        req.user = { _id: userId, role: "vendor" };
        next();
    } catch (err) {
        console.error("[protectVendor]", err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// SECURITY FIX: protectVendor alone never checks Vendor.status — it only
// verifies the JWT and attaches req.vendor. A handful of routes
// (notifications, settings, subscription-read) were gated by protectVendor
// alone, so an already-suspended vendor's still-valid token kept working
// on them until natural JWT expiry. This blocks only "suspended"
// (deliberately NOT pending/rejected/under_review — those pre-approval
// statuses are legitimate and routes needing full approval already use
// requireApprovedVendor). GET /vendor/me and GET /vendor/status must NOT
// use this — a suspended vendor still needs to fetch their own status so
// the panel can render the "suspended" screen instead of erroring.
export const blockSuspendedVendor = (req, res, next) => {
    if (req.vendor?.status === "suspended") {
        return res.status(403).json({
            success: false,
            message: "Your vendor account has been suspended. Contact support for details.",
            vendorStatus: "suspended",
        });
    }
    next();
};

export const requireApprovedVendor = (req, res, next) => {
    if (req.vendor?.status !== "approved") {
        return res.status(403).json({
            success: false,
            message: "Access denied. Your vendor account is not approved yet.",
            vendorStatus: req.vendor?.status || "unknown",
        });
    }
    next();
};

export const requireActiveSubscription = async (req, res, next) => {
    try {
        const sub = await Subscription.findOne({ vendorId: req.vendor._id }).lean();

        if (!sub || sub.status !== "active") {
            return res.status(403).json({
                success: false,
                message: "Subscription required. Please activate a plan to access this feature.",
                subscriptionRequired: true,
                subscriptionStatus: sub?.status || "none",
                redirectTo: "/subscription",
            });
        }

        if (sub.expiryDate && new Date() > new Date(sub.expiryDate)) {
            // Auto-mark as expired in DB (fire-and-forget)
            Subscription.findByIdAndUpdate(sub._id, { status: "expired" }).catch(() => {});
            return res.status(403).json({
                success: false,
                message: "Subscription expired. Please renew your plan to continue.",
                subscriptionExpired: true,
                subscriptionStatus: "expired",
                expiryDate: sub.expiryDate,
                redirectTo: "/subscription",
            });
        }

        req.subscription = sub;
        next();
    } catch (err) {
        console.error("[requireActiveSubscription]", err);
        return res.status(500).json({ success: false, message: "Subscription check failed" });
    }
};

/**
 * Combined guard: approved + active subscription
 * Use this for product management, order management routes
 */
export const requireApprovedAndSubscribed = async (req, res, next) => {
    // First check approval
    if (req.vendor?.status !== "approved") {
        return res.status(403).json({
            success: false,
            message: "Access denied. Your vendor account is not approved yet.",
            vendorStatus: req.vendor?.status || "unknown",
        });
    }
    // Then check subscription
    try {
        const sub = await Subscription.findOne({ vendorId: req.vendor._id }).lean();

        if (!sub || sub.status !== "active") {
            return res.status(403).json({
                success: false,
                message: "Active subscription required. Please activate a plan.",
                subscriptionRequired: true,
                subscriptionStatus: sub?.status || "none",
                redirectTo: "/subscription",
            });
        }

        if (sub.expiryDate && new Date() > new Date(sub.expiryDate)) {
            Subscription.findByIdAndUpdate(sub._id, { status: "expired" }).catch(() => {});
            return res.status(403).json({
                success: false,
                message: "Subscription expired. Please renew your plan.",
                subscriptionExpired: true,
                subscriptionStatus: "expired",
                expiryDate: sub.expiryDate,
                redirectTo: "/subscription",
            });
        }

        req.subscription = sub;
        next();
    } catch (err) {
        console.error("[requireApprovedAndSubscribed]", err);
        return res.status(500).json({ success: false, message: "Subscription check failed" });
    }
};
