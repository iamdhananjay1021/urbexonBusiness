import jwt from "jsonwebtoken";
import User from "../models/User.js";
import AdminAuditLog from "../models/adminModels/AdminAuditLog.js";

/**
 * 1. HTTP-Only Cookie Auth Guard
 * Enterprise standard: prevents XSS token theft.
 */
export const protectAdmin = async (req, res, next) => {
    try {
        let token;
        if (req.cookies && req.cookies.admin_jwt) {
            token = req.cookies.admin_jwt;
        } else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
            token = req.headers.authorization.split(" ")[1];
        }

        if (!token) return res.status(401).json({ success: false, message: "Not authorized, no token" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select("-password");

        if (!user || (user.role === "user" || user.role === "vendor" || user.role === "delivery")) {
            return res.status(403).json({ success: false, message: "Access denied. Admins only." });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: "Not authorized, token failed" });
    }
};

/**
 * 2. Strict Role-Based Access Control (RBAC)
 */
export const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Role (${req.user?.role}) is not allowed to perform this action.`
            });
        }
        next();
    };
};

/**
 * 3. Immutable Audit Logging Middleware
 */
export const auditLog = (action) => async (req, res, next) => {
    // Extract target ID before mutation. req.vendor?._id (set by
    // protectVendor) covers self-mutation routes with no :id param —
    // e.g. PUT /vendor/me — where params.id/body.id would otherwise be
    // null and the log entry would carry no reference to which vendor
    // it was about.
    const targetId = req.params.id || req.body.id || req.body.vendorId || req.vendor?._id || null;

    res.on('finish', async () => {
        if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
            try {
                const payload = { ...req.body };
                delete payload.password; // Sanitize
                await AdminAuditLog.create({ adminId: req.user._id, role: req.user.role, action, endpoint: req.originalUrl, method: req.method, targetId, ipAddress: req.ip, userAgent: req.headers['user-agent'], newState: payload });
            } catch (e) { console.error("Audit log failed", e); }
        }
    });
    next();
};