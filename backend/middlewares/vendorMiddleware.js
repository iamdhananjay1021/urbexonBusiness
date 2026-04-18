/**
 * vendorMiddleware.js — FIXED
 *
 * BUG WAS: protectVendor was doing Vendor.findOne({ userId }) but then
 * setting req.vendor = that doc. Later venderProfile.js was doing
 * Vendor.findOne({ userId: req.vendor._id }) — double-lookup with wrong field.
 *
 * FIX: protectVendor now sets req.vendor = the full Vendor document.
 *      Controllers use req.vendor directly (no second DB query needed for reads).
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

        // Fetch full vendor document (controllers use req.vendor directly)
        const vendor = await Vendor.findOne({ userId, isDeleted: false });
        if (!vendor)
            return res.status(404).json({ success: false, message: "Vendor profile not found. Please apply first." });

        req.vendor = vendor;          // full Vendor doc — _id is vendor's own _id
        req.user = { _id: userId };   // user's _id (for routes that also need user)
        next();
    } catch (err) {
        console.error("[protectVendor]", err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const requireApprovedVendor = (req, res, next) => {
    if (req.vendor?.status !== "approved") {
        return res.status(403).json({
            success: false,
            message: "Access denied. Your vendor account is not approved yet.",
            status: req.vendor?.status || "unknown",
        });
    }
    next();
};

export const requireActiveSubscription = async (req, res, next) => {
    try {
        const sub = await Subscription.findOne({ vendorId: req.vendor._id }).lean();
        if (!sub || !["active"].includes(sub.status))
            return res.status(403).json({
                success: false,
                message: "Your subscription is not active. Please activate a plan to continue.",
                subscriptionRequired: true,
                subscriptionStatus: sub?.status || "none",
            });
        if (sub.expiryDate && new Date() > new Date(sub.expiryDate))
            return res.status(403).json({
                success: false,
                message: "Subscription expired. Please renew to continue.",
                subscriptionExpired: true,
                subscriptionStatus: "expired",
                expiryDate: sub.expiryDate,
            });
        req.subscription = sub;
        next();
    } catch (err) {
        console.error("[requireActiveSubscription]", err);
        return res.status(500).json({ success: false, message: "Subscription check failed" });
    }
};
