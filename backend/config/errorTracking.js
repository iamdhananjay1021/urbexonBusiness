/**
 * config/errorTracking.js — the ONE error-tracking integration point.
 *
 * Previously nothing in the stack reported errors anywhere except local,
 * ephemeral log files (see utils/logger.js) — a production 500 or an
 * unhandled exception had no path to notify anyone. This wraps Sentry,
 * entirely env-gated: with SENTRY_DSN unset, every export below is a
 * harmless no-op, so this is safe to wire in everywhere without requiring
 * a real account to exist yet.
 *
 * Also the landing point for client-side errors from all four frontend
 * apps (see routes/clientErrorRoutes.js) — one aggregation point instead
 * of four separate frontend SDK installs/DSNs to manage.
 */
import * as Sentry from "@sentry/node";

const DSN = process.env.SENTRY_DSN?.trim();
let initialized = false;

export const initErrorTracking = () => {
    if (!DSN) {
        console.log("ℹ️  SENTRY_DSN not set — error tracking disabled (logger.js + console only)");
        return;
    }
    Sentry.init({
        dsn: DSN,
        environment: process.env.NODE_ENV || "development",
        tracesSampleRate: 0.1,
    });
    initialized = true;
    console.log("✅ Error tracking (Sentry) initialized");
};

export const isErrorTrackingEnabled = () => initialized;

/** captureException(err, context) — safe to call unconditionally; no-ops if disabled. */
export const captureException = (err, context = {}) => {
    if (!initialized || !err) return;
    try {
        Sentry.captureException(err, { extra: context });
    } catch {
        // Never let the error tracker itself throw.
    }
};

/** captureMessage(message, context) — for non-exception events worth tracking. */
export const captureMessage = (message, context = {}) => {
    if (!initialized || !message) return;
    try {
        Sentry.captureMessage(message, { extra: context });
    } catch {
        // Never let the error tracker itself throw.
    }
};
