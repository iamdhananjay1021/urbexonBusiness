/**
 * errorMiddleware.js — Production
 * Proper error responses, no stack traces in production
 */
import { captureException } from "../config/errorTracking.js";

export const notFound = (req, res) => {
    res.status(404).json({ success: false,  message: `Route not found: ${req.method} ${req.originalUrl}` });
};

export const errorHandler = (err, req, res, _next) => {
    const statusCode = err.statusCode || err.status || (res.statusCode === 200 ? 500 : res.statusCode);

    // Log server errors
    if (statusCode >= 500) {
        console.error("[ErrorHandler]", err.message, err.stack);
        captureException(err, { path: req.originalUrl, method: req.method, statusCode });
    }

    // Mongoose validation error
    if (err.name === "ValidationError") {
        const messages = Object.values(err.errors).map((e) => e.message);
        return res.status(400).json({ message: messages.join(", "), errors: messages });
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || "field";
        return res.status(400).json({ success: false,  message: `${field} already exists` });
    }

    // JWT error
    if (err.name === "JsonWebTokenError") {
        return res.status(401).json({ success: false,  message: "Invalid token" });
    }
    if (err.name === "TokenExpiredError") {
        return res.status(401).json({ success: false,  message: "Token expired", expired: true });
    }

    // CORS error
    if (err.message?.includes("CORS")) {
        return res.status(403).json({ success: false,  message: "CORS not allowed" });
    }

    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal server error",
        ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    });
};
