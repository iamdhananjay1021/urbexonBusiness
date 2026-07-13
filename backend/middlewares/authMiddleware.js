import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Fail fast at startup if secret missing — don't let this surface later as a mystery 401.
if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables");
}

const isProd = process.env.NODE_ENV === "production";

/**
 * Structured, safe auth-error logging.
 * - Never logs the raw token, cookies, or Authorization header (credential leak risk).
 * - Logs enough request context (method, path, IP) to debug/trace abuse patterns.
 * - Full stack trace only outside production; in prod just the error name+message
 *   (swap this block for your real logger — pino/winston/Sentry etc. — in real prod).
 */
const logAuthError = (error, req) => {
    const meta = {
        name: error.name,
        message: error.message,
        path: req.originalUrl,
        method: req.method,
        ip: req.ip,
        time: new Date().toISOString(),
    };
    if (isProd) {
        console.error("[AUTH_ERROR]", JSON.stringify(meta));
    } else {
        console.error("[AUTH_ERROR]", meta, error.stack);
    }
};

/* ── PROTECT ── */
export const protect = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization?.startsWith("Bearer ")) {
            token = req.headers.authorization.split(" ")[1];
        } else if (req.query?.token) {
            // NOTE: token-in-URL is a known tradeoff for SSE/WebSocket (can't set headers there).
            // Risk: tokens can leak via server access logs, browser history, Referer headers.
            // If possible, prefer short-lived, single-use tokens for this path instead of the main JWT.
            token = req.query.token;
        } else if (req.cookies?.token) {
            token = req.cookies.token;
        }

        if (!token) {
            return res.status(401).json({ success: false, message: "Not authorized, token missing" });
        }

        // Explicitly restrict algorithms to prevent algorithm-confusion attacks
        // (e.g. attacker crafting an "alg: none" or HS/RS mismatched token).
        const decoded = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: ["HS256"], // change if you actually sign with a different algorithm
        });

        const userId = decoded.id || decoded._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Invalid token payload" });
        }

        const user = await User.findById(userId).select("-password");
        if (!user) {
            return res.status(401).json({ success: false, message: "User not found" });
        }

        // Block disabled/banned/deleted accounts even if their token is still valid.
        if (user.isBanned || user.isDeleted || user.status === "disabled") {
            return res.status(403).json({ success: false, message: "Account is disabled" });
        }

        // Token version validation — lets you invalidate ALL previously issued tokens
        // for a user instantly (password change, logout-everywhere, forced security reset)
        // by bumping user.tokenVersion in the DB. Old tokens carry the old version and
        // will be rejected here even though they haven't technically "expired".
        // Requires: User schema has a `tokenVersion` (Number, default 0) field, and your
        // sign-token function includes `tokenVersion: user.tokenVersion` in the JWT payload.
        if (typeof user.tokenVersion === "number") {
            const tokenVersion = decoded.tokenVersion ?? 0;
            if (tokenVersion !== user.tokenVersion) {
                return res.status(401).json({ success: false, message: "Token expired, please log in again", expired: true });
            }
        }

        req.user = user;
        next();
    } catch (error) {
        logAuthError(error, req);
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ success: false, message: "Token expired", expired: true });
        }
        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({ success: false, message: "Not authorized, token invalid" });
        }
        // Anything else (DB error etc.) — don't call it a token problem.
        return res.status(500).json({ success: false, message: "Authentication failed" });
    }
};

/* ── OPTIONAL AUTH ──
   Same token verification as `protect`, but never rejects the request —
   attaches req.user when a valid token is present, otherwise leaves it
   undefined and calls next() regardless. For routes that must stay public
   (e.g. the contact form, which guests use too) but still want to know
   the caller's identity when they happen to be logged in. */
export const optionalAuth = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization?.startsWith("Bearer ")) {
            token = req.headers.authorization.split(" ")[1];
        } else if (req.cookies?.token) {
            token = req.cookies.token;
        }
        if (!token) return next();

        const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
        const userId = decoded.id || decoded._id;
        if (!userId) return next();

        const user = await User.findById(userId).select("-password");
        if (!user || user.isBanned || user.isDeleted || user.status === "disabled") return next();
        if (typeof user.tokenVersion === "number" && (decoded.tokenVersion ?? 0) !== user.tokenVersion) return next();

        req.user = user;
        next();
    } catch {
        // Any failure (expired/invalid token, DB error) — treat as anonymous,
        // never block the request.
        next();
    }
};

/* ── ROLE-BASED ACCESS (factory) ── */
// Single source of truth for "is user authenticated + has allowed role".
const requireRole = (...allowedRoles) => (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    if (allowedRoles.includes(req.user.role)) {
        return next();
    }
    return res.status(403).json({ success: false, message: "Access denied. Insufficient permissions." });
};

/* ── ADMIN / OWNER ── */
export const adminOnly = requireRole("admin", "owner");

/* ── OWNER ONLY ── */
export const ownerOnly = requireRole("owner");

/* ── VENDOR ONLY ── */
export const vendorOnly = requireRole("vendor");

/* ── DELIVERY BOY ONLY ── */
export const deliveryOnly = requireRole("delivery_boy");