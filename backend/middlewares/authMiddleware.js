import jwt from "jsonwebtoken";
import User from "../models/User.js";

/* ── PROTECT ── */
export const protect = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization?.startsWith("Bearer ")) {
            token = req.headers.authorization.split(" ")[1];
        } else if (req.query?.token) {
            token = req.query.token; // Fallback for EventSource (SSE) / WebSockets
        } else if (req.cookies?.token) {
            token = req.cookies.token;
        }

        if (!token) return res.status(401).json({ success: false, message: "Not authorized, token missing" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id || decoded._id;
        if (!userId) return res.status(401).json({ success: false, message: "Invalid token payload" });

        const user = await User.findById(userId).select("-password");
        if (!user) return res.status(401).json({ success: false, message: "User not found" });

        req.user = user;
        next();
    } catch (error) {
        console.error("JWT ERROR:", error.message);
        // Differentiate expired vs invalid
        if (error.name === "TokenExpiredError")
            return res.status(401).json({ success: false, message: "Token expired", expired: true });
        return res.status(401).json({ success: false, message: "Not authorized, token invalid" });
    }
};

/* ── ADMIN / OWNER ── */
export const adminOnly = (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: "Not authenticated" });
    if (["admin", "owner"].includes(req.user.role)) return next();
    return res.status(403).json({ success: false, message: "Access denied. Admin permission required." });
};

/* ── OWNER ONLY ── */
export const ownerOnly = (req, res, next) => {
    if (req.user?.role === "owner") return next();
    return res.status(403).json({ success: false, message: "Owner access only" });
};

/* ── VENDOR ONLY ── */
export const vendorOnly = (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: "Not authenticated" });
    if (req.user.role === "vendor") return next();
    return res.status(403).json({ success: false, message: "Vendor account required." });
};

/* ── DELIVERY BOY ONLY ── */
export const deliveryOnly = (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: "Not authenticated" });
    if (req.user.role === "delivery_boy") return next();
    return res.status(403).json({ success: false, message: "Delivery partner account required." });
};
