/**
 * clientErrorRoutes.js — receives error reports from the 4 frontend apps'
 * ErrorBoundary components and forwards them into the same error-tracking
 * sink as backend errors (config/errorTracking.js). No auth required (an
 * error boundary can fire before/without a logged-in session) — public,
 * rate-limited, and deliberately narrow: it only ever writes to the error
 * tracker, never to the database.
 */
import express from "express";
import { captureMessage } from "../config/errorTracking.js";
import logger from "../utils/logger.js";

const router = express.Router();

const ALLOWED_APPS = ["client", "admin", "vendor-panel", "delivery-panel"];

router.post("/", (req, res) => {
    const { message, stack, url, app } = req.body || {};
    const appName = ALLOWED_APPS.includes(app) ? app : "unknown";
    const safeMessage = String(message || "Unknown frontend error").slice(0, 500);
    const safeStack = String(stack || "").slice(0, 4000);
    const safeUrl = String(url || "").slice(0, 500);

    captureMessage(`[frontend:${appName}] ${safeMessage}`, { stack: safeStack, url: safeUrl });
    logger.error(`[frontend:${appName}] ${safeMessage}`, { url: safeUrl }).catch(() => {});

    res.status(204).end();
});

export default router;
