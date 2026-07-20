/**
 * slaConfig.js — SLA targets for vendor support tickets.
 *
 * Plain constants with env overrides rather than a DB-backed config doc:
 * there's no admin SLA-editing UI in Phase 1, the sweep job runs every 15
 * minutes and shouldn't pay a DB read per tick for values that change
 * once a quarter, and env overrides already cover per-environment tuning
 * (same reasoning as DELIVERY_CONFIG in config/deliveryConfig.js).
 */

const envHours = (name, fallback) => {
    const v = Number(process.env[name]);
    return Number.isFinite(v) && v >= 0 ? v : fallback;
};

export const SLA_CONFIG = {
    // Hours until the first non-internal admin reply is due.
    firstResponseHours: {
        urgent: envHours("SLA_FIRST_RESPONSE_URGENT_H", 2),
        high: envHours("SLA_FIRST_RESPONSE_HIGH_H", 4),
        normal: envHours("SLA_FIRST_RESPONSE_NORMAL_H", 12),
        low: envHours("SLA_FIRST_RESPONSE_LOW_H", 24),
    },
    // Hours until the ticket should be resolved.
    resolutionHours: {
        urgent: envHours("SLA_RESOLUTION_URGENT_H", 24),
        high: envHours("SLA_RESOLUTION_HIGH_H", 48),
        normal: envHours("SLA_RESOLUTION_NORMAL_H", 96),
        low: envHours("SLA_RESOLUTION_LOW_H", 168),
    },
    // Extra grace after a missed first-response deadline before the sweep
    // escalates (priority bump + urgent admin alert) instead of only
    // reminding.
    escalationGraceHours: {
        urgent: envHours("SLA_ESCALATION_GRACE_URGENT_H", 1),
        high: envHours("SLA_ESCALATION_GRACE_HIGH_H", 2),
        normal: envHours("SLA_ESCALATION_GRACE_NORMAL_H", 6),
        low: envHours("SLA_ESCALATION_GRACE_LOW_H", 12),
    },
    // Days after resolution/closure during which a vendor can reopen.
    reopenWindowDays: envHours("SLA_REOPEN_WINDOW_DAYS", 7),
};

const HOUR_MS = 60 * 60 * 1000;

/**
 * Compute both SLA due dates for a ticket at creation (or on priority
 * change / reopen, which restart the clock from `from`).
 */
export const computeSlaDates = (priority, from = new Date()) => {
    const p = SLA_CONFIG.firstResponseHours[priority] !== undefined ? priority : "normal";
    return {
        slaFirstResponseDueAt: new Date(from.getTime() + SLA_CONFIG.firstResponseHours[p] * HOUR_MS),
        slaResolutionDueAt: new Date(from.getTime() + SLA_CONFIG.resolutionHours[p] * HOUR_MS),
    };
};
